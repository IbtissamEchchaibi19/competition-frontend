import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Bot, User, Loader, Volume2, VolumeX, Eye, Languages, Accessibility, Play, ExternalLink, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';

const API_BASE_URL = 'https://multiagentsystem-mmve.onrender.com/api';

function WhatsAppChatbot() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId] = useState(`user-${Date.now()}`);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [showASL, setShowASL] = useState(false);
  const [aslVideoVisible, setAslVideoVisible] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([
      {
        id: 1,
        text: "👋 Hi! I'm your AI assistant. I can help you with:\n\n📰 News & Research\n🌤️ Weather Information\n📧 Email & Calendar\n🛒 Grocery Shopping\n🖼️ Image & Video Search\n\n♿ Accessibility features enabled: Voice, ASL, High Contrast\n\nWhat can I help you with today?",
        sender: 'bot',
        timestamp: new Date(),
        agent: 'system'
      }
    ]);
  }, []);

  // Enhanced parser for images and videos with better URL extraction
  const parseMessage = (text) => {
    if (!text) return [];

    const elements = [];
    let currentText = text;
    
    // Extract image URLs - multiple patterns
    const imagePatterns = [
      /🖼️\s*Image URL:\s*(https?:\/\/[^\s\n]+)/gi,
      /!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/gi,
      /Image:\s*(https?:\/\/[^\s\n]+)/gi,
      /imageUrl['":\s]*(https?:\/\/[^\s'"}\n]+)/gi
    ];
    
    // Extract video URLs - multiple patterns
    const videoPatterns = [
      /🎥\s*Video URL:\s*(https?:\/\/[^\s\n]+)/gi,
      /Video:\s*(https?:\/\/[^\s\n]+)/gi,
      /\[Video[^\]]*\]\((https?:\/\/[^\)]+)\)/gi,
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&\n]+)/gi
    ];

    const images = [];
    const videos = [];

    // Find all images
    imagePatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(text)) !== null) {
        const url = match[2] || match[1];
        if (url && !images.some(img => img.url === url)) {
          images.push({
            index: match.index,
            length: match[0].length,
            url: url,
            alt: match[1] || 'Image'
          });
        }
      }
    });

    // Find all videos
    videoPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern);
      while ((match = regex.exec(text)) !== null) {
        const url = match[1] || match[0];
        if (url && !videos.some(vid => vid.url === url)) {
          // Convert YouTube URLs to embed format
          let embedUrl = url;
          if (url.includes('youtube.com/watch?v=')) {
            const videoId = url.split('v=')[1]?.split('&')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
          } else if (url.includes('youtu.be/')) {
            const videoId = url.split('youtu.be/')[1]?.split('?')[0];
            embedUrl = `https://www.youtube.com/embed/${videoId}`;
          }
          videos.push({
            index: match.index,
            length: match[0].length,
            url: embedUrl,
            originalUrl: url
          });
        }
      }
    });

    // Remove image/video syntax from text for clean display
    [...images, ...videos].forEach(media => {
      const searchText = text.substring(media.index, media.index + media.length);
      currentText = currentText.replace(searchText, '');
    });

    // Also remove standalone URLs that are images/videos
    currentText = currentText.replace(/🖼️\s*Image URL:\s*https?:\/\/[^\s\n]+/gi, '');
    currentText = currentText.replace(/🎥\s*Video URL:\s*https?:\/\/[^\s\n]+/gi, '');
    
    // Parse remaining text
    const lines = currentText.split('\n');
    let inList = false;

    lines.forEach((line, idx) => {
      // Check for bold text **text**
      const boldRegex = /\*\*([^\*]+)\*\*/g;
      let lastIndex = 0;
      const parts = [];

      let boldMatch;
      while ((boldMatch = boldRegex.exec(line)) !== null) {
        if (boldMatch.index > lastIndex) {
          parts.push({ type: 'text', content: line.substring(lastIndex, boldMatch.index) });
        }
        parts.push({ type: 'bold', content: boldMatch[1] });
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        parts.push({ type: 'text', content: line.substring(lastIndex) });
      }

      // Check for links in the parts
      const finalParts = [];
      parts.forEach(part => {
        if (part.type === 'text') {
          const urlMatch = /(?:🔗\s*)?(?:https?:\/\/[^\s]+|\[([^\]]+)\]\((https?:\/\/[^\)]+)\))/g;
          let lastUrlIndex = 0;
          let urlMatchResult;

          while ((urlMatchResult = urlMatch.exec(part.content)) !== null) {
            if (urlMatchResult.index > lastUrlIndex) {
              finalParts.push({ 
                type: 'text', 
                content: part.content.substring(lastUrlIndex, urlMatchResult.index) 
              });
            }
            
            const linkUrl = urlMatchResult[2] || urlMatchResult[0].replace('🔗', '').trim();
            const linkText = urlMatchResult[1] || linkUrl;
            
            finalParts.push({ 
              type: 'link', 
              content: linkText,
              url: linkUrl
            });
            lastUrlIndex = urlMatch.lastIndex;
          }

          if (lastUrlIndex < part.content.length) {
            finalParts.push({ 
              type: 'text', 
              content: part.content.substring(lastUrlIndex) 
            });
          }
        } else {
          finalParts.push(part);
        }
      });

      // Check if it's a list item
      const listMatch = line.match(/^\d+\.\s+(.+)/);
      if (listMatch) {
        if (!inList) {
          elements.push({ type: 'list-start' });
          inList = true;
        }
        elements.push({ type: 'list-item', parts: finalParts.length > 0 ? finalParts : [{ type: 'text', content: line }] });
      } else {
        if (inList) {
          elements.push({ type: 'list-end' });
          inList = false;
        }
        if (line.trim()) {
          elements.push({ type: 'paragraph', parts: finalParts.length > 0 ? finalParts : [{ type: 'text', content: line }] });
        }
      }
    });

    if (inList) {
      elements.push({ type: 'list-end' });
    }

    // Add media at the end
    if (images.length > 0) {
      elements.push({ type: 'images', images });
    }
    if (videos.length > 0) {
      elements.push({ type: 'videos', videos });
    }

    return elements;
  };

  const renderParsedMessage = (elements) => {
    let listCounter = 0;

    return elements.map((element, idx) => {
      switch (element.type) {
        case 'paragraph':
          return (
            <p key={idx} className="mb-2 leading-relaxed">
              {element.parts.map((part, partIdx) => {
                switch (part.type) {
                  case 'bold':
                    return <strong key={partIdx} className="font-semibold">{part.content}</strong>;
                  case 'link':
                    return (
                      <a
                        key={partIdx}
                        href={part.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline break-all inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3 inline" />
                        {part.content.length > 50 ? part.content.substring(0, 50) + '...' : part.content}
                      </a>
                    );
                  default:
                    return <span key={partIdx}>{part.content}</span>;
                }
              })}
            </p>
          );
        
        case 'list-start':
          listCounter = 0;
          return null;
        
        case 'list-item':
          listCounter++;
          return (
            <div key={idx} className="flex gap-2 mb-2 ml-2">
              <span className="font-semibold text-green-600 flex-shrink-0">{listCounter}.</span>
              <div className="flex-1">
                {element.parts.map((part, partIdx) => {
                  switch (part.type) {
                    case 'bold':
                      return <strong key={partIdx} className="font-semibold">{part.content}</strong>;
                    case 'link':
                      return (
                        <a
                          key={partIdx}
                          href={part.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline break-all inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3 inline" />
                          {part.content.length > 50 ? part.content.substring(0, 50) + '...' : part.content}
                        </a>
                      );
                    default:
                      return <span key={partIdx}>{part.content}</span>;
                  }
                })}
              </div>
            </div>
          );
        
        case 'images':
          return (
            <div key={idx} className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <ImageIcon className="w-4 h-4" />
                <span>{element.images.length} Image{element.images.length > 1 ? 's' : ''} Found</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {element.images.map((img, imgIdx) => (
                  <div key={imgIdx} className="rounded-lg overflow-hidden border-2 border-gray-300 bg-white shadow-md hover:shadow-xl transition-shadow">
                    <div className="aspect-video bg-gray-100 flex items-center justify-center">
                      <img
                        src={img.url}
                        alt={img.alt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.parentElement.innerHTML = `
                            <div class="flex flex-col items-center justify-center w-full h-full text-gray-400">
                              <svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                              </svg>
                              <span class="text-sm">Image unavailable</span>
                            </div>
                          `;
                        }}
                      />
                    </div>
                    <div className="p-3 bg-gray-50">
                      <a 
                        href={img.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open in new tab
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        
        case 'videos':
          return (
            <div key={idx} className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <VideoIcon className="w-4 h-4" />
                <span>{element.videos.length} Video{element.videos.length > 1 ? 's' : ''} Found</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {element.videos.map((video, vidIdx) => (
                  <div key={vidIdx} className="rounded-lg overflow-hidden border-2 border-gray-300 bg-white shadow-md">
                    <div className="aspect-video bg-black">
                      {video.url.includes('youtube.com/embed/') ? (
                        <iframe
                          src={video.url}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={`Video ${vidIdx + 1}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-900">
                          <a
                            href={video.originalUrl || video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-col items-center gap-3 text-white hover:text-blue-400 transition-colors"
                          >
                            <Play className="w-16 h-16" />
                            <span className="text-sm">Click to watch video</span>
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="p-3 bg-gray-50">
                      <a 
                        href={video.originalUrl || video.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Open in new tab
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        
        default:
          return null;
      }
    });
  };

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
        stage: data.stage,
        audioBase64: data.audio_base64
      };

      setMessages(prev => [...prev, botMessage]);
      setCurrentAgent(data.current_agent);

      if (autoPlayAudio && data.audio_base64) {
        playAudio(data.audio_base64);
      }

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        text: `❌ Connection Error: Unable to reach the server. Please ensure the backend is running at ${API_BASE_URL}`,
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
      alert('Microphone access denied. Please enable microphone permissions in your browser settings.');
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
      text: '🎤 Processing voice message...',
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

      setMessages(prev => 
        prev.map(msg => 
          msg.id === userMessage.id 
            ? { ...msg, text: data.transcription || 'Voice message sent' }
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

      if (autoPlayAudio && data.audio_base64) {
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
      media_agent: '🎬',
      system: '🤖',
      error: '❌'
    };
    return emojis[agent] || '🤖';
  };

  const getAgentColor = (agent) => {
    if (highContrast) {
      return agent === 'error' ? 'bg-red-100 border-red-900' : 'bg-white border-black';
    }
    const colors = {
      news_agent: 'bg-blue-50 border-blue-300',
      weather_agent: 'bg-sky-50 border-sky-300',
      email_agent: 'bg-purple-50 border-purple-300',
      grocery_agent: 'bg-green-50 border-green-300',
      media_agent: 'bg-pink-50 border-pink-300',
      system: 'bg-gray-50 border-gray-300',
      error: 'bg-red-50 border-red-300'
    };
    return colors[agent] || 'bg-gray-50 border-gray-300';
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getFontSizeClass = () => {
    const sizes = {
      small: 'text-xs',
      medium: 'text-sm',
      large: 'text-base',
      xlarge: 'text-lg'
    };
    return sizes[fontSize] || sizes.medium;
  };

  const quickActions = [
    { text: '📰 Latest AI news', icon: '📰' },
    { text: '🖼️ Show me images of cats', icon: '🖼️' },
    { text: '🎥 Python tutorial videos', icon: '🎥' },
    { text: '🛒 I need milk and bread', icon: '🛒' }
  ];

  return (
    <div className={`flex flex-col h-screen ${highContrast ? 'bg-white' : 'bg-gradient-to-br from-green-50 to-green-100'}`}>
      {/* Header */}
      <div className={`${highContrast ? 'bg-black' : 'bg-green-600'} text-white px-6 py-4 shadow-lg`}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${highContrast ? 'bg-yellow-400' : 'bg-white'} rounded-full flex items-center justify-center`}>
              <Bot className={`w-7 h-7 ${highContrast ? 'text-black' : 'text-green-600'}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold">AI Assistant ♿</h1>
              <p className={`text-sm ${highContrast ? 'text-yellow-300' : 'text-green-100'}`}>
                {currentAgent ? `Active: ${currentAgent.replace('_', ' ')}` : 'Ready to help'}
              </p>
            </div>
          </div>
          
          {/* Accessibility Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoPlayAudio(!autoPlayAudio)}
              className={`p-2 rounded-lg transition-colors ${autoPlayAudio ? 'bg-green-500' : 'bg-gray-600'}`}
              title="Toggle auto-play audio"
            >
              {autoPlayAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`p-2 rounded-lg transition-colors ${highContrast ? 'bg-yellow-500 text-black' : 'bg-gray-600'}`}
              title="Toggle high contrast"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowASL(!showASL)}
              className={`p-2 rounded-lg transition-colors ${showASL ? 'bg-blue-500' : 'bg-gray-600'}`}
              title="Toggle ASL interpretation (Coming Soon)"
            >
              <Languages className="w-4 h-4" />
            </button>
            <select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value)}
              className="px-2 py-1 rounded bg-white text-black text-xs"
              title="Text size"
            >
              <option value="small">A</option>
              <option value="medium">A+</option>
              <option value="large">A++</option>
              <option value="xlarge">A+++</option>
            </select>
          </div>
        </div>
      </div>

      {/* ASL Notice */}
      {showASL && (
        <div className="bg-blue-100 border-b border-blue-300 px-6 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <Accessibility className="w-5 h-5 text-blue-700" />
            <p className="text-sm text-blue-800">
              🤟 ASL Interpretation Mode Active (Feature Coming Soon) - Sign language video interpretation will appear here
            </p>
          </div>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex gap-2 max-w-[85%] ${
                  message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user'
                      ? highContrast ? 'bg-black text-yellow-300' : 'bg-green-600 text-white'
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
                <div className="flex-1">
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-md ${getFontSizeClass()} ${
                      message.sender === 'user'
                        ? highContrast ? 'bg-black text-white border-2 border-yellow-400 rounded-tr-none' : 'bg-green-600 text-white rounded-tr-none'
                        : `${getAgentColor(message.agent)} border-2 rounded-tl-none ${highContrast ? 'border-black' : ''}`
                    }`}
                  >
                    {message.agent && message.sender === 'bot' && (
                      <div className={`text-xs font-semibold mb-2 pb-2 border-b ${highContrast ? 'border-black' : 'border-gray-300'} opacity-70 uppercase`}>
                        {getAgentEmoji(message.agent)} {message.agent.replace('_', ' ')}
                      </div>
                    )}
                    <div className="leading-relaxed">
                      {renderParsedMessage(parseMessage(message.text))}
                    </div>
                    {message.audioBase64 && (
                      <button
                        onClick={() => playAudio(message.audioBase64)}
                        className={`mt-2 flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                          highContrast ? 'bg-yellow-400 text-black' : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } transition-colors`}
                      >
                        <Volume2 className="w-3 h-3" />
                        Play Audio Response
                      </button>
                    )}
                  </div>
                  <div
                    className={`text-xs mt-1 px-1 ${
                      message.sender === 'user' ? 'text-right' : 'text-left'
                    } ${highContrast ? 'text-black font-semibold' : 'text-gray-500'}`}
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
                <div className={`w-8 h-8 ${highContrast ? 'bg-black' : 'bg-gray-200'} rounded-full flex items-center justify-center`}>
                  <Loader className={`w-5 h-5 ${highContrast ? 'text-yellow-400' : 'text-gray-600'} animate-spin`} />
                </div>
                <div className={`${highContrast ? 'bg-black border-2 border-yellow-400' : 'bg-gray-200'} rounded-2xl px-4 py-3 rounded-tl-none`}>
                  <div className="flex gap-1">
                    <div className={`w-2 h-2 ${highContrast ? 'bg-yellow-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                    <div className={`w-2 h-2 ${highContrast ? 'bg-yellow-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                    <div className={`w-2 h-2 ${highContrast ? 'bg-yellow-400' : 'bg-gray-500'} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
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
                  className={`${
                    highContrast 
                      ? 'bg-white hover:bg-gray-200 border-2 border-black' 
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                  } rounded-xl px-4 py-3 ${getFontSizeClass()} text-left transition-colors shadow-sm`}
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
      <div className={`${highContrast ? 'bg-black' : 'bg-white'} border-t ${highContrast ? 'border-yellow-400' : 'border-gray-200'} px-4 py-4`}>
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          {/* Voice Recording Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-3 rounded-full transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : highContrast ? 'bg-yellow-400 hover:bg-yellow-500 text-black' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={isLoading}
            title="Voice input"
          >
            {isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Text Input */}
          <div className={`flex-1 ${highContrast ? 'bg-white border-2 border-black' : 'bg-gray-100'} rounded-3xl px-4 py-2 flex items-center`}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message..."
              className={`flex-1 bg-transparent outline-none ${getFontSizeClass()} ${highContrast ? 'text-black placeholder-gray-600' : ''}`}
              disabled={isLoading || isRecording}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading || isRecording}
            className={`p-3 rounded-full transition-colors ${
              highContrast 
                ? 'bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-400 text-black' 
                : 'bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white'
            } disabled:cursor-not-allowed`}
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Indicator */}
        {isRecording && (
          <div className="text-center mt-2">
            <p className={`${getFontSizeClass()} font-semibold animate-pulse ${
              highContrast ? 'text-red-600' : 'text-red-600'
            }`}>
              🔴 Recording... Tap mic to stop
            </p>
          </div>
        )}

        {/* Status Info */}
        <div className="text-center mt-2">
          <p className={`text-xs ${highContrast ? 'text-black font-semibold' : 'text-gray-500'}`}>
            Press Enter to send • Click mic for voice • {messages.length - 1} messages
          </p>
          <p className={`text-xs mt-1 ${highContrast ? 'text-black font-semibold' : 'text-gray-500'}`}>
            ♿ Accessibility: {highContrast ? 'High Contrast ON' : 'Standard'} • Font: {fontSize.toUpperCase()} • Audio: {autoPlayAudio ? 'ON' : 'OFF'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default WhatsAppChatbot;