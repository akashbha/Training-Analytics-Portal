// src/pages/Messages.jsx
// Private messaging between trainees and trainers with strict batch scoping.
// Enforces 500-character boundary with live counter and clear role separation.

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiClient } from "../api/client.js";
import { LoadingState, ErrorState, EmptyState } from "../components/states/index.js";
import { UnauthorizedPage } from "./UnauthorizedPage.jsx";

export function Messages() {
  const { user, isAdmin } = useAuth();

  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState("");

  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");

  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");

  const threadEndRef = useRef(null);

  // Load eligible contacts
  const loadContacts = useCallback(async () => {
    if (isAdmin) return;
    setContactsLoading(true);
    setContactsError("");
    try {
      const res = await apiClient.get("/messages/contacts");
      const list = res.data || [];
      setContacts(list);
      if (list.length > 0 && !selectedContact) {
        setSelectedContact(list[0]);
      }
    } catch (err) {
      setContactsError(err.message || "Failed to load eligible contacts.");
    } finally {
      setContactsLoading(false);
    }
  }, [isAdmin, selectedContact]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load message thread with selected contact
  const loadThread = useCallback(async (contactId) => {
    if (!contactId) return;
    setMessagesLoading(true);
    setMessagesError("");
    try {
      const res = await apiClient.get(`/messages/with/${contactId}?page=1&page_size=50`);
      setMessages(res.data?.items || []);
      // Mark inbound messages as read
      await apiClient.put(`/messages/with/${contactId}/read`);
    } catch (err) {
      setMessagesError(err.message || "Failed to load message thread.");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedContact?.id) {
      loadThread(selectedContact.id);
    }
  }, [selectedContact, loadThread]);

  // Scroll to bottom on new messages
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !selectedContact?.id || submitting) return;

    setSubmitting(true);
    setSendError("");
    try {
      await apiClient.post("/messages", {
        recipient_id: selectedContact.id,
        body: trimmed,
      });
      setInputText("");
      await loadThread(selectedContact.id);
    } catch (err) {
      setSendError(err.message || "Failed to deliver message.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isAdmin) {
    return (
      <UnauthorizedPage message="Administrative accounts cannot send or read private messages." />
    );
  }

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Messages</h1>
        <p className="text-xs text-slate-500 mt-1">
          Private communication with your assigned batch mentors and peers.
        </p>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white border border-slate-200 rounded-lg overflow-hidden min-h-[560px]">
        {/* Left: Contacts List */}
        <div className="md:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/50">
          <div className="p-3.5 border-b border-slate-200 bg-white">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Contacts ({contacts.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {contactsLoading ? (
              <LoadingState message="Loading contacts..." compact />
            ) : contactsError ? (
              <ErrorState message={contactsError} onRetry={loadContacts} compact />
            ) : contacts.length === 0 ? (
              <EmptyState
                title="No contacts"
                description="No assigned batch peers or trainers found."
                compact
              />
            ) : (
              contacts.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedContact(c)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 border-l-4 border-blue-600"
                        : "hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {c.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                          c.role === "trainer"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {c.role === "trainer" ? "Trainer" : "Trainee"}
                      </span>
                    </div>
                    {c.batch_name && (
                      <div className="text-[11px] text-slate-500 truncate mt-1">
                        {c.batch_name}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Conversation Thread */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {selectedContact ? (
            <>
              {/* Thread Header */}
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/30">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">
                    {selectedContact.name}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {selectedContact.email} - {selectedContact.batch_name || "Batch"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => loadThread(selectedContact.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  Refresh
                </button>
              </div>

              {/* Messages Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[360px] max-h-[460px]">
                {messagesLoading ? (
                  <LoadingState message="Loading conversation..." />
                ) : messagesError ? (
                  <ErrorState
                    message={messagesError}
                    onRetry={() => loadThread(selectedContact.id)}
                  />
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="No messages yet."
                    description="Send a message below to start the conversation."
                  />
                ) : (
                  messages.map((m) => {
                    const isSelf = m.sender_id === user?.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3.5 py-2 text-xs break-words ${
                            isSelf
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 border border-slate-200 text-slate-800"
                          }`}
                        >
                          <p className="leading-relaxed">{m.body}</p>
                        </div>
                        <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-400">
                          <span>{formatTimestamp(m.created_at)}</span>
                          {isSelf && m.read_at && (
                            <span className="text-emerald-600 font-medium">Read</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </div>

              {/* Thread Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3.5 border-t border-slate-200 bg-slate-50/50 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Write message</span>
                  <span
                    className={`text-[11px] font-mono tabular-nums ${
                      inputText.length >= 480
                        ? "text-rose-600 font-bold"
                        : "text-slate-400"
                    }`}
                  >
                    {inputText.length}/500
                  </span>
                </div>

                <textarea
                  rows={3}
                  maxLength={500}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type your message (max 500 characters)..."
                  className="w-full bg-white border border-slate-200 rounded p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-600 resize-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {500 - inputText.length} characters left
                  </span>
                  <button
                    type="submit"
                    disabled={submitting || !inputText.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded transition-colors cursor-pointer"
                  >
                    {submitting ? "Sending..." : "Send Message"}
                  </button>
                </div>

                {sendError && (
                  <div className="text-[11px] text-rose-600 font-medium">{sendError}</div>
                )}
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 text-xs">
              Select a contact to view the conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
