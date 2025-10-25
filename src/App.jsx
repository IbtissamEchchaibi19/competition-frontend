import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Bot, User, Loader } from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

function WhatsAppChatbot() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId] = useState(`user-${Date.now()}`);
  const [currentAgent, setCurrentAgent] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "👋 Hi! I'm your AI assistant. I can help you with:\n\n📰 News & Research\n🌤️ Weather Information\n📧 Email & Calendar\n🛒 Grocery Shopping\n\nWhat can I help you with today?",
        sender: 'bot',
        timestamp: new Date(),
        agent: 'system'
      }
    ]);
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          session_id: sessionId
        })
      });

      const data = await response.json();

      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        agent: data.agent_name,
        stage: data.stage
      };

      setMessages(prev => [...prev, botMessage]);
      setCurrentAgent(data.current_agent);

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: `❌ Error: ${error.message}. Please make sure the backend is running at ${API_BASE_URL}`,
        sender: 'bot',
        timestamp: new Date(),
        agent: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setIsLoading(true);

    const userMessage = {
      id: Date.now(),
      text: '🎤 Voice message...',
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);

      const response = await fetch(`${API_BASE_URL}/audio/process?session_id=${sessionId}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      // Update user message with transcription
      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, text: data.transcription }
            : msg
        )
      );

      const botMessage = {
        id: Date.now() + 1,
        text: data.response,
        sender: 'bot',
        timestamp: new Date(),
        agent: data.agent_name,
        audioBase64: data.audio_base64
      };

      setMessages(prev => [...prev, botMessage]);
      setCurrentAgent(data.current_agent);

      // Play audio response
      if (data.audio_base64) {
        playAudio(data.audio_base64);
      }

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: `❌ Audio processing failed: ${error.message}`,
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (base64Audio) => {
    try {
      const audioData = atob(base64Audio);
      const audioArray = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioArray[i] = audioData.charCodeAt(i);
      }
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const getAgentEmoji = (agent) => {
    const emojis = {
      news_agent: '📰',
      weather_agent: '🌤️',
      email_agent: '📧',
      grocery_agent: '🛒',
      system: '🤖',
      error: '❌'
    };
    return emojis[agent] || '🤖';
  };

  const getAgentColor = (agent) => {
    const colors = {
      news_agent: 'bg-blue-100 border-blue-300',
      weather_agent: 'bg-sky-100 border-sky-300',
      email_agent: 'bg-purple-100 border-purple-300',
      grocery_agent: 'bg-green-100 border-green-300',
      system: 'bg-gray-100 border-gray-300',
      error: 'bg-red-100 border-red-300'
    };
    return colors[agent] || 'bg-gray-100 border-gray-300';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const quickActions = [
    { text: '📰 Latest AI news', icon: '📰' },
    { text: '🌤️ Weather in London', icon: '🌤️' },
    { text: '🛒 I need milk and bread', icon: '🛒' },
    { text: '📧 Check my emails', icon: '📧' }
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-green-50 to-green-100">
      {/* Header */}
      <div className="bg-green-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
              <Bot className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Assistant</h1>
              <p className="text-sm text-green-100">
                {currentAgent ? `Active: ${currentAgent.replace('_', ' ')}` : 'Ready to help'}
              </p>
            </div>
          </div>
          <div className="text-sm text-green-100">
            Session: {sessionId.slice(-8)}
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex gap-2 max-w-[75%] ${
                  message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user'
                      ? 'bg-green-600 text-white'
                      : getAgentColor(message.agent)
                  }`}
                >
                  {message.sender === 'user' ? (
                    <User className="w-5 h-5" />
                  ) : (
                    <span className="text-lg">{getAgentEmoji(message.agent)}</span>
                  )}
                </div>

                {/* Message Bubble */}
                <div>
                  <div
                    className={`rounded-2xl px-4 py-2 shadow-md ${
                      message.sender === 'user'
                        ? 'bg-green-600 text-white rounded-tr-none'
                        : `${getAgentColor(message.agent)} border rounded-tl-none`
                    }`}
                  >
                    {message.agent && message.sender === 'bot' && (
                      <div className="text-xs font-semibold mb-1 opacity-70">
                        {message.agent.replace('_', ' ').toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                    {message.stage && (
                      <div className="text-xs mt-2 pt-2 border-t border-gray-300 opacity-70">
                        Stage: {message.stage}
                      </div>
                    )}
                  </div>
                  <div
                    className={`text-xs text-gray-500 mt-1 px-1 ${
                      message.sender === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <Loader className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
                <div className="bg-gray-200 rounded-2xl px-4 py-3 rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => sendMessage(action.text)}
                  className="bg-white hover:bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-left transition-colors shadow-sm"
                  disabled={isLoading}
                >
                  <span className="mr-2">{action.icon}</span>
                  {action.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          {/* Voice Recording Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={isLoading}
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2 flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-transparent outline-none text-sm"
              disabled={isLoading || isRecording}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading || isRecording}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-3 rounded-full transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="text-center mt-2">
            <p className="text-sm text-red-600 font-semibold animate-pulse">
              🔴 Recording... Click mic to stop
            </p>
          </div>
        )}

        {/* Status Info */}
        <div className="text-center mt-2">
          <p className="text-xs text-gray-500">
            Press Enter to send • Click mic for voice • {messages.length - 1} messages
          </p>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppChatbot;