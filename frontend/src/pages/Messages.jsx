// src/pages/Messages.jsx
// Private messaging and batch cohort channel communications with file attachments.
// Enforces batch scoping, 500-character limits, 5 MB file size constraints, and strict role boundaries.

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  RotateCw,
  CheckCheck,
  User,
  FileText,
  Download,
  X,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { apiClient } from "../api/client.js";
import { LoadingState, ErrorState, EmptyState } from "../components/states/index.js";
import { UnauthorizedPage } from "./UnauthorizedPage.jsx";

const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".docx", ".txt", ".md"];
const MAX_ATTACHMENTS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function Messages() {
  const { user, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();

  const targetUserParam = searchParams.get("user") || searchParams.get("trainee_id") || searchParams.get("recipient_id");
  const targetNameParam = searchParams.get("name");
  const targetBatchParam = searchParams.get("batch");

  // Active channel mode: "private" or "batch"
  const [activeTab, setActiveTab] = useState(targetUserParam || targetNameParam ? "private" : "batch");

  // Contacts for private messaging
  const [contacts, setContacts] = useState([]);
  const [contactSearchQuery, setContactSearchQuery] = useState("");
  const [contactsLoading, setContactsLoading] = useState(true);
  const [contactsError, setContactsError] = useState("");
  const [selectedContact, setSelectedContact] = useState(null);

  // Available batches for batch channel
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // Messages feed
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");

  // Composer state
  const [inputText, setInputText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState("");

  const threadEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  // Load eligible contacts for private messaging and batch determination
  const loadContacts = useCallback(async () => {
    if (isAdmin) return;
    setContactsLoading(true);
    setContactsError("");
    try {
      const res = await apiClient.get("/messages/contacts");
      const list = res.data || [];
      setContacts(list);

      // Extract unique batch options from contacts or fallback to batches endpoint
      const batchMap = new Map();
      list.forEach((c) => {
        if (c.batch_id && !batchMap.has(c.batch_id)) {
          batchMap.set(c.batch_id, {
            id: c.batch_id,
            name: c.batch_name ? c.batch_name.replace(" (Trainer)", "") : `Batch ${c.batch_id}`,
          });
        }
      });

      if (batchMap.size > 0) {
        const batchList = Array.from(batchMap.values());
        setBatches(batchList);
        setSelectedBatch((prev) => {
          if (prev) return prev;
          if (targetBatchParam) {
            const foundBatch = batchList.find((b) => Number(b.id) === Number(targetBatchParam));
            return foundBatch || batchList[0];
          }
          return batchList[0];
        });
      } else {
        // Fallback: query batches list
        try {
          const bRes = await apiClient.get("/batches?page=1&page_size=20");
          const bItems = bRes.data?.items || [];
          if (bItems.length > 0) {
            setBatches(bItems);
            setSelectedBatch((prev) => {
              if (prev) return prev;
              if (targetBatchParam) {
                const foundBatch = bItems.find((b) => Number(b.id) === Number(targetBatchParam));
                return foundBatch || bItems[0];
              }
              return bItems[0];
            });
          }
        } catch {
          // Keep batches list empty if not accessible
        }
      }

      // Check if URL specifies a target contact
      if (targetUserParam || targetNameParam) {
        setActiveTab("private");
        const found = list.find((c) => {
          if (targetUserParam && (Number(c.id) === Number(targetUserParam) || Number(c.trainee_id) === Number(targetUserParam))) {
            return true;
          }
          if (targetNameParam && c.name?.toLowerCase().includes(targetNameParam.toLowerCase())) {
            return true;
          }
          return false;
        });
        if (found) {
          setSelectedContact(found);
          setTimeout(() => inputRef.current?.focus(), 300);
        } else if (list.length > 0) {
          setSelectedContact((prev) => prev || list[0]);
        }
      } else if (list.length > 0) {
        setSelectedContact((prev) => prev || list[0]);
      }
    } catch (err) {
      setContactsError(err.message || "Failed to load eligible contacts.");
    } finally {
      setContactsLoading(false);
    }
  }, [isAdmin, targetUserParam, targetNameParam, targetBatchParam]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Load messages for current channel view
  const loadMessages = useCallback(async () => {
    if (isAdmin) return;

    if (activeTab === "private") {
      if (!selectedContact?.id) {
        setMessages([]);
        return;
      }
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const res = await apiClient.get(`/messages/private/${selectedContact.id}?page=1&page_size=50`);
        setMessages(res.data?.items || []);
        // Mark inbound private messages as read
        try {
          await apiClient.put(`/messages/private/${selectedContact.id}/read`);
        } catch {
          // Non-blocking read receipt update
        }
      } catch (err) {
        setMessagesError(err.message || "Failed to load private message thread.");
      } finally {
        setMessagesLoading(false);
      }
    } else if (activeTab === "batch") {
      if (!selectedBatch?.id) {
        setMessages([]);
        return;
      }
      setMessagesLoading(true);
      setMessagesError("");
      try {
        const res = await apiClient.get(`/messages/batch/${selectedBatch.id}?page=1&page_size=50`);
        setMessages(res.data?.items || []);
      } catch (err) {
        setMessagesError(err.message || "Failed to load batch channel messages.");
      } finally {
        setMessagesLoading(false);
      }
    }
  }, [isAdmin, activeTab, selectedContact, selectedBatch]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom on message updates
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle file selection with validation
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setSendError("");
    const newFiles = [...selectedFiles];

    for (const file of files) {
      if (newFiles.length >= MAX_ATTACHMENTS) {
        setSendError(`Maximum ${MAX_ATTACHMENTS} attachments allowed per message.`);
        break;
      }

      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        setSendError(`File ${file.name} has an unsupported format. Allowed: PDF, PNG, JPG, DOCX, TXT, MD.`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        setSendError(`File ${file.name} exceeds the 5 MB maximum size limit.`);
        continue;
      }

      newFiles.push(file);
    }

    setSelectedFiles(newFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Download attachment with authentication
  const handleDownloadAttachment = async (attachmentId, originalFilename) => {
    try {
      const res = await apiClient.get(`/messages/attachments/${attachmentId}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", originalFilename);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      setSendError(err.message || "Failed to download attachment.");
    }
  };

  // Send message and upload attachments
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();

    if (!trimmed && selectedFiles.length === 0) {
      setSendError("Message body or at least one attachment is required.");
      return;
    }

    if (activeTab === "private" && !selectedContact?.id) {
      setSendError("Select a contact for private messaging.");
      return;
    }

    if (activeTab === "batch" && !selectedBatch?.id) {
      setSendError("Select a batch channel to post.");
      return;
    }

    setSubmitting(true);
    setSendError("");

    try {
      // 1. Post message record
      const payload = {
        channel: activeTab,
        body: trimmed || "[Attachment file]",
        recipient_id: activeTab === "private" ? selectedContact.id : undefined,
        batch_id: activeTab === "batch" ? selectedBatch.id : undefined,
      };

      const res = await apiClient.post("/messages", payload);
      const createdMessage = res.data;

      // 2. Upload attachments if selected
      if (selectedFiles.length > 0 && createdMessage?.id) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("file", file);
          await apiClient.post(`/messages/${createdMessage.id}/attachments`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
      }

      // 3. Clear composer state and refresh feed
      setInputText("");
      setSelectedFiles([]);
      await loadMessages();
    } catch (err) {
      setSendError(err.message || "Failed to deliver message.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearchQuery.trim()) return contacts;
    const q = contactSearchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.batch_name?.toLowerCase().includes(q)
    );
  }, [contacts, contactSearchQuery]);

  if (isAdmin) {
    return (
      <UnauthorizedPage message="Administrative accounts cannot send or read messages." />
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

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#F09A3E] selection:text-white">
      {/* Header & Channel Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0E3D5]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#1C1B17] text-white flex items-center justify-center shadow-xs shrink-0">
            <MessageSquare className="w-4 h-4 text-[#F09A3E]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-[#1C1B17] tracking-tight">
                Messages & Intervention Channels
              </h1>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                Live Chat
              </span>
            </div>
            <p className="text-xs text-[#787063] font-medium mt-0.5">
              Direct private threads with learners and batch-wide collaboration feeds.
            </p>
          </div>
        </div>

        {/* Tab Selector: Private vs Batch Channel */}
        <div className="inline-flex rounded-xl border border-[#FBD1A7] p-1 bg-[#FEF4E8] shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("private")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "private"
                ? "bg-[#1C1B17] text-white shadow-xs"
                : "text-[#787063] hover:text-[#1C1B17]"
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Private Threads</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("batch")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "batch"
                ? "bg-[#1C1B17] text-white shadow-xs"
                : "text-[#787063] hover:text-[#1C1B17]"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Batch Channel</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-0 bg-white border border-[#F0E3D5] rounded-2xl shadow-[0_2px_12px_rgba(28,27,23,0.03)] overflow-hidden min-h-[620px]">
        {/* Left Column: Contacts or Batch Info */}
        <div className="md:col-span-4 border-r border-[#F0E3D5] flex flex-col bg-[#FAF6F0]/60">
          {activeTab === "private" ? (
            <>
              {/* Contacts Header with Search Input */}
              <div className="p-3.5 border-b border-[#F0E3D5] bg-white space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#1C1B17] uppercase tracking-wider">
                    Eligible Contacts
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF0E1] text-[#D97718] border border-[#FBD1A7]">
                    {contacts.length} Available
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#A2998A] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full bg-[#FAF6F0] border border-[#F0E3D5] rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#1C1B17] placeholder:text-[#A2998A] focus:outline-none focus:border-[#F09A3E] focus:bg-white transition-all"
                  />
                  {contactSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setContactSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-[#A2998A] hover:text-[#1C1B17]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Contacts Scrollable List */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#F0E3D5]/50 max-h-[520px]">
                {contactsLoading ? (
                  <LoadingState message="Loading contacts..." compact className="py-8" />
                ) : contactsError ? (
                  <ErrorState message={contactsError} onRetry={loadContacts} compact className="py-8" />
                ) : filteredContacts.length === 0 ? (
                  <EmptyState
                    title="No contacts found"
                    description={contactSearchQuery ? "No contacts match search query." : "No assigned batch peers found."}
                    compact
                    className="py-8"
                  />
                ) : (
                  filteredContacts.map((c) => {
                    const isSelected = selectedContact?.id === c.id;
                    const initials = c.name
                      ? c.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      : "TR";

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedContact(c)}
                        className={`w-full text-left p-3.5 transition-all cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? "bg-[#FEF4E8] border-l-4 border-[#F09A3E]"
                            : "hover:bg-[#FDF8F2]"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs border ${
                            isSelected
                              ? "bg-[#1C1B17] text-[#F09A3E] border-[#272520]"
                              : "bg-white text-[#787063] border-[#F0E3D5]"
                          }`}
                        >
                          {initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-bold truncate ${
                                isSelected ? "text-[#1C1B17]" : "text-[#4A443B]"
                              }`}
                            >
                              {c.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 uppercase tracking-wider ${
                                c.role === "trainer"
                                  ? "bg-purple-50 text-purple-700 border-purple-200"
                                  : "bg-[#FEF0E1] text-[#D97718] border-[#FBD1A7]"
                              }`}
                            >
                              {c.role}
                            </span>
                          </div>

                          <div className="text-[11px] text-[#A2998A] truncate mt-0.5">
                            {c.batch_name || c.email}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Batch Channel Info & Selection */
            <div className="p-5 space-y-4">
              <div className="bg-white border border-[#F0E3D5] rounded-xl p-4 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97718]">
                  Cohort Broadcast Channel
                </span>
                <h2 className="text-sm font-extrabold text-[#1C1B17] mt-1">
                  {selectedBatch ? selectedBatch.name : "Batch Channel"}
                </h2>
                <p className="text-xs text-[#787063] mt-1.5 leading-relaxed">
                  Public discussion feed for all learners and assigned trainers in this cohort.
                </p>
              </div>

              {batches.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-[#1C1B17] mb-1.5">
                    Select Cohort Channel
                  </label>
                  <select
                    value={selectedBatch?.id || ""}
                    onChange={(e) => {
                      const found = batches.find((b) => b.id === Number(e.target.value));
                      if (found) setSelectedBatch(found);
                    }}
                    className="w-full text-xs border border-[#F0E3D5] rounded-xl px-3 py-2 bg-white text-[#1C1B17] font-semibold focus:outline-none focus:border-[#F09A3E]"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border border-[#F0E3D5] rounded-xl bg-white p-4 text-xs text-[#787063] space-y-2 shadow-2xs">
                <div className="font-bold text-[#1C1B17] uppercase tracking-wider text-[11px]">
                  Channel Guidelines
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F09A3E] mt-1.5 shrink-0" />
                  <span>Posts are broadcast to all learners and mentors enrolled in this batch.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F09A3E] mt-1.5 shrink-0" />
                  <span>Attachments are securely scoped to authenticated cohort members.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F09A3E] mt-1.5 shrink-0" />
                  <span>Maximum 3 files per message, 5 MB limit per attachment.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Conversation Stream & Composer */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {/* Channel Header Bar */}
          <div className="p-4 border-b border-[#F0E3D5] flex items-center justify-between bg-[#FAF6F0]/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#1C1B17] text-[#F09A3E] font-black text-xs flex items-center justify-center shadow-2xs border border-[#272520]">
                {activeTab === "batch" ? (
                  <Users className="w-4 h-4 text-[#F09A3E]" />
                ) : selectedContact?.name ? (
                  selectedContact.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                ) : (
                  <User className="w-4 h-4 text-[#F09A3E]" />
                )}
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-[#1C1B17]">
                  {activeTab === "batch"
                    ? `Batch Channel: ${selectedBatch ? selectedBatch.name : "Cohort"}`
                    : selectedContact
                    ? `Direct Thread: ${selectedContact.name}`
                    : "Private Messages"}
                </h3>
                <p className="text-[11px] text-[#787063] font-medium">
                  {activeTab === "batch"
                    ? "Visible to enrolled learners and assigned instructional staff"
                    : selectedContact
                    ? `${selectedContact.email} (${selectedContact.role})`
                    : "Select a contact to start conversation"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadMessages}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F0E3D5] bg-white hover:bg-[#FEF4E8] text-[#1C1B17] text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Refresh conversation feed"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#D97718]" />
              <span>Refresh</span>
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 min-h-[380px] max-h-[480px] bg-[#FDF8F2]/30">
            {messagesLoading ? (
              <LoadingState message="Retrieving conversation history..." className="py-12" />
            ) : messagesError ? (
              <ErrorState message={messagesError} onRetry={loadMessages} className="py-12" />
            ) : messages.length === 0 ? (
              <EmptyState
                title="No messages yet in this thread."
                description={
                  activeTab === "batch"
                    ? "Post a message or shared resource to initiate the cohort conversation."
                    : "Send a direct message below to start private mentoring with this learner."
                }
                className="py-12"
              />
            ) : (
              messages.map((m) => {
                const isSelf = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-[#787063] font-medium mb-1">
                      <span className="font-bold text-[#1C1B17]">{m.sender_name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded-md bg-[#FEF4E8] text-[#D97718] border border-[#FBD1A7] font-bold">
                        {m.sender_role || (isSelf ? user?.role : "Member")}
                      </span>
                      <span className="text-[#A2998A]">{formatTimestamp(m.created_at)}</span>
                    </div>

                    <div
                      className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-xs break-words shadow-2xs ${
                        isSelf
                          ? "bg-[#1C1B17] text-white rounded-tr-xs"
                          : "bg-[#FAF6F0] border border-[#F0E3D5] text-[#1C1B17] rounded-tl-xs"
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>

                      {/* Attachments */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-white/20 space-y-1.5">
                          {m.attachments.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => handleDownloadAttachment(att.id, att.filename || att.original_filename)}
                              className={`flex items-center justify-between w-full text-left px-2.5 py-1.5 rounded-xl text-[11px] cursor-pointer transition-colors ${
                                isSelf
                                  ? "bg-white/10 hover:bg-white/20 text-white"
                                  : "bg-white hover:bg-[#FEF4E8] text-[#1C1B17] border border-[#F0E3D5]"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 truncate mr-2">
                                <FileText className="w-3.5 h-3.5 text-[#F09A3E] shrink-0" />
                                <span className="truncate font-semibold">
                                  {att.filename || att.original_filename}
                                </span>
                              </div>
                              <span className="text-[10px] opacity-75 shrink-0 font-mono">
                                {formatFileSize(att.size || att.size_bytes)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {isSelf && m.read_at && activeTab === "private" && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-1">
                        <CheckCheck className="w-3 h-3" />
                        <span>Read</span>
                      </span>
                    )}
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Staged Attachments Preview */}
          {selectedFiles.length > 0 && (
            <div className="px-4 py-2.5 bg-[#FAF6F0] border-t border-[#F0E3D5] flex flex-wrap gap-2">
              {selectedFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="inline-flex items-center gap-2 bg-white border border-[#F0E3D5] rounded-xl px-3 py-1 text-xs text-[#1C1B17] shadow-2xs font-medium"
                >
                  <FileText className="w-3.5 h-3.5 text-[#D97718]" />
                  <span className="truncate max-w-[140px]">{f.name}</span>
                  <span className="text-[10px] text-[#A2998A] font-mono">
                    ({formatFileSize(f.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="text-[#A2998A] hover:text-rose-600 font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Message Composer Form */}
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-[#F0E3D5] bg-[#FAF6F0]/50 space-y-2.5"
          >
            <div className="flex items-center justify-between text-xs font-bold text-[#1C1B17]">
              <span>Compose Message</span>
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  inputText.length >= 480 ? "text-rose-600 font-bold" : "text-[#A2998A]"
                }`}
              >
                {inputText.length}/500
              </span>
            </div>

            <textarea
              ref={inputRef}
              rows={3}
              maxLength={500}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                activeTab === "batch"
                  ? "Post to the batch channel (max 500 characters)..."
                  : selectedContact
                  ? `Write a direct message to ${selectedContact.name}...`
                  : "Type your private message (max 500 characters)..."
              }
              className="w-full bg-white border border-[#F0E3D5] rounded-xl p-3 text-xs text-[#1C1B17] placeholder:text-[#A2998A] focus:outline-none focus:border-[#F09A3E] resize-none transition-all shadow-2xs"
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.docx,.txt,.md,application/pdf,image/png,image/jpeg,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  id="message-file-picker"
                />
                <label
                  htmlFor="message-file-picker"
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[#F0E3D5] bg-white hover:bg-[#FEF4E8] text-[#1C1B17] cursor-pointer shadow-2xs transition-colors ${
                    selectedFiles.length >= MAX_ATTACHMENTS ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <Paperclip className="w-3.5 h-3.5 text-[#D97718]" />
                  <span>Attach ({selectedFiles.length}/{MAX_ATTACHMENTS})</span>
                </label>
                <span className="text-[11px] text-[#A2998A]">
                  Max 3 files, 5 MB limit (PDF, PNG, JPG, DOCX, TXT, MD).
                </span>
              </div>

              <button
                type="submit"
                disabled={submitting || (!inputText.trim() && selectedFiles.length === 0)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#F09A3E] hover:bg-[#D97718] disabled:opacity-40 rounded-xl shadow-xs transition-all cursor-pointer self-end sm:self-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? "Sending..." : "Send Message"}</span>
              </button>
            </div>

            {sendError && (
              <div className="text-xs text-rose-600 font-bold mt-1 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                {sendError}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default Messages;
