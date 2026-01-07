// frontend/src/pages/AiChat.jsx

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import shopService from "../services/shopService";
import { Send, Sparkles, Trash2, Brain } from "lucide-react"; // Import new icons

const CHAT_STORAGE_KEY = "triactAiChatHistory";

const AiChat = () => {
  const { user } = useAuth();

  // This ref is for the scrolling <div>
  const messagesContainerRef = useRef(null);

  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem(CHAT_STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          return parsedMessages;
        }
      } catch (e) {
        console.error("Failed to parse chat history from localStorage:", e);
      }
    }
    return [
      {
        sender: "ai",
        text: "Hi! I'm your TRIACT AI assistant. Ask me questions about your inventory, sales, or employees.",
      },
    ];
  });

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // --- THIS IS THE SCROLL FIX ---
  // This useEffect now correctly scrolls the messagesContainerRef
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [messages]); // Runs every time the `messages` array changes

  useEffect(() => {
    if (
      messages.length > 1 ||
      messages[0].sender !== "ai" ||
      messages[0].text !==
        "Hi! I'm your TRIACT AI assistant. Ask me questions about your inventory, sales, or employees."
    ) {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  const handleSubmit = async (e) => {
  e.preventDefault();
  if (!input.trim() || isLoading) return;

  const userMessage = { sender: 'user', text: input };
  const userInput = input; // Save the input before clearing
  
  setMessages((prev) => [...prev, userMessage]);
  setInput('');
  setIsLoading(true);

  try {
    console.log('Sending to AI:', userInput);
    
    // Send just the string, shopService will wrap it
    const response = await shopService.getAiChatResponse(user.shopId, userInput);
    
    console.log('AI Response:', response);

    const aiMessage = { 
      sender: 'ai', 
      text: response.reply || response.answer || 'No response received' 
    };
    
    setMessages((prev) => [...prev, aiMessage]);
  } catch (error) {
    console.error('AI Chat Error:', error);
    console.error('Error response:', error.response?.data);
    
    const errorMessage = {
      sender: 'ai',
      text: error.response?.data?.message || 'Sorry, I ran into an error. Please try again.',
    };
    setMessages((prev) => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};



  const clearChatHistory = () => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([
      {
        sender: "ai",
        text: "Chat history cleared. How can I help you?",
      },
    ]);
  };

  return (
    // --- THIS IS THE LAYOUT FIX ---
    // Removed 'items-center' and added 'pt-8'
    <div className="flex justify-center h-[calc(100vh-112px)] pt-2">
      {/* Chat window with new light theme */}
      <div className="flex flex-col h-full max-h-[700px] w-full max-w-2xl bg-white shadow-xl rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <Sparkles className="text-indigo-600" size={22} />
            <span>TRIACT AI Assistant</span>
          </h1>
          <button
            onClick={clearChatHistory}
            className="text-sm text-gray-600 hover:text-red-600 border border-gray-300 px-3 py-1.5 rounded-lg transition-colors duration-200 hover:border-red-500 flex items-center gap-1.5"
            title="Clear chat history"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>

        {/* Chat Area */}
        {/* --- ADDED THE REF HERE --- */}
        <div
          ref={messagesContainerRef}
          className="flex-1 p-5 space-y-5 overflow-y-auto bg-gray-50"
        >
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start gap-3 ${
                msg.sender === "ai" ? "justify-start" : "justify-end"
              }`}
            >
              {/* AI Avatar */}
              {msg.sender === "ai" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <Brain size={18} />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`max-w-[75%] px-5 py-3 rounded-2xl shadow-sm text-sm break-words ${
                  msg.sender === "ai"
                    ? "bg-white text-gray-800 border border-gray-200 rounded-tl-none"
                    : "bg-indigo-600 text-white rounded-tr-none"
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-start gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                <Brain size={18} />
              </div>
              <div className="max-w-[60%] px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 shadow-sm rounded-tl-none">
                <p className="animate-pulse">AI is thinking...</p>
              </div>
            </div>
          )}

          {/* --- THE OLD SCROLL-TO DIV IS REMOVED FROM HERE --- */}
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center p-4 border-t border-gray-200 bg-white space-x-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about inventory, sales, or employees..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-gray-400 disabled:bg-gray-100 transition-all duration-150"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors duration-200 disabled:bg-gray-400"
            disabled={isLoading || !input.trim()}
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default AiChat;
