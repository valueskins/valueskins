'use client';

import React, { useState, useRef, useEffect } from 'react';
import ProfileLink from './ProfileLink';

interface Message {
  id: number;
  sender: 'me' | 'brand';
  text: string;
  timestamp: string;
  fullTimestamp: string;
  type: 'message' | 'status';
}

interface DealRoomChatProps {
  dealId: string;
  brandId?: string | number;
  brandName: string;
  brandCategory?: string;
  brandDeals?: number;
  brandAvatar?: string;
  initialMessages: Message[];
  onSendMessage: (text: string) => void;
}

const C_DOCUMENTED = '#0A0A0A';

export default function DealRoomChat({
  dealId,
  brandId,
  brandName,
  brandCategory,
  brandDeals,
  brandAvatar,
  initialMessages,
  onSendMessage,
}: DealRoomChatProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [inputText, setInputText] = useState('');
  const [showTimestampWarning, setShowTimestampWarning] = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleCalendarExport = () => {
    window.location.href = `/api/deals/calendar-export?dealId=${dealId}`;
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    if (!consentGiven) {
      setConsentGiven(true);
    }

    const now = new Date();
    const fullTimestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const newMessage: Message = {
      id: messages.length + 1,
      sender: 'me',
      text: inputText,
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      fullTimestamp: fullTimestamp,
      type: 'message',
    };

    setMessages([...messages, newMessage]);
    onSendMessage(inputText);
    setInputText('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--c-surface)',
        borderRadius: '8px',
        border: '1px solid var(--c-border)',
        overflow: 'hidden',
      }}
    >
      {/* Documentation Warning Banner (existing, unchanged) */}
      {showTimestampWarning && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--c-border)',
            borderBottom: '1px solid var(--c-border)',
            fontSize: '12px',
            color: 'var(--c-text)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <strong>Documentation Priority:</strong> All messages are logged with exact timestamps for dispute resolution. Do not share personal information. This chat is ONLY for deal documentation.
          </div>
          <button
            onClick={() => setShowTimestampWarning(false)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--c-text)',
              padding: '0 8px',
            }}
          >
            X
          </button>
        </div>
      )}

      {/* Header with documented badge */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>
              Deal with{' '}
              {brandId ? (
                <ProfileLink
                  type="brand"
                  id={brandId}
                  name={brandName}
                  avatar={brandAvatar}
                  category={brandCategory}
                  dealsCount={brandDeals}
                  href={`/brand/${brandId}`}
                />
              ) : (
                brandName
              )}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--c-text-variant)', margin: '4px 0 0 0' }}>
              Status: In Progress
            </p>
          </div>
          {/* Persistent documented indicator — never dismissable */}
          <div
            title="All messages in this chat are permanently recorded with hash-chain integrity for legal evidence"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: 'rgba(10, 10, 10, 0.08)',
              border: '1px solid rgba(10, 10, 10, 0.3)',
              fontSize: '11px',
              fontWeight: 600,
              color: C_DOCUMENTED,
              whiteSpace: 'nowrap',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C_DOCUMENTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Documented
          </div>
        </div>
        <button
          onClick={handleCalendarExport}
          style={{
            padding: '8px 12px',
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
          title="Export deal deadline to your calendar (Google, Apple, Outlook)"
        >
          Add to Calendar
        </button>
      </div>

      {/* Consent notice — shown before first message */}
      {!consentGiven && messages.length === 0 && (
        <div
          style={{
            padding: '12px 16px',
            background: 'rgba(10, 10, 10, 0.04)',
            borderBottom: '1px solid rgba(10, 10, 10, 0.15)',
            fontSize: '12px',
            color: 'var(--c-text)',
            lineHeight: 1.5,
          }}
        >
          By sending a message, you consent to this conversation being permanently recorded
          with cryptographic integrity verification. This record may be used as evidence
          in dispute resolution proceedings.
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.type === 'status' ? (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--c-text-variant)',
                  textAlign: 'center',
                  width: '100%',
                  padding: '8px',
                }}
              >
                {msg.text}
              </div>
            ) : (
              <div
                style={{
                  maxWidth: '70%',
                  background: msg.sender === 'me' ? '#0A0A0A' : '#f3f4f6',
                  color: msg.sender === 'me' ? '#ffffff' : 'var(--c-text)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  wordBreak: 'break-word',
                }}
              >
                <div>{msg.text}</div>
                <div
                  style={{
                    fontSize: '10px',
                    opacity: 0.65,
                    marginTop: '6px',
                    fontFamily: 'monospace',
                  }}
                  title={msg.fullTimestamp}
                >
                  {msg.fullTimestamp || msg.timestamp}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid var(--c-border)',
          background: 'var(--c-surface)',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type your message..."
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--c-border)',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          style={{
            padding: '10px 16px',
            background: 'var(--c-surface)',
            color: 'var(--c-text)',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
