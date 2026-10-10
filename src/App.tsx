import React, { useState, useMemo } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  ANDROID_DEPLOYMENT_STEPS,
  PROCFILE_CONTENT,
  REQUIREMENTS_TXT_CONTENT,
  buildBotPyContent,
  ProjectFile,
} from './data/botFiles';

interface SimMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
  buttons?: Array<{
    label: string;
    type: 'url' | 'callback';
    url?: string;
    callbackData?: string;
  }>;
}

interface ApiLogEntry {
  id: string;
  timestamp: string;
  method: string;
  statusReturned: string;
  passed: boolean;
}

const JOIN_CHANNEL_URL = 'https://t.me/+maKoLPmHtag0ZDFl';
const UNLOCKED_LINK_URL = 'https://t.me/+4sZzvY5R6hI3ZWVl';

export default function App() {
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [customChannelId, setCustomChannelId] = useState<string>('');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Simulator State
  const [isUserJoinedChannel, setIsUserJoinedChannel] = useState<boolean>(false);
  const [isBotAdminInChannel, setIsBotAdminInChannel] = useState<boolean>(true);
  const [toastAlert, setToastAlert] = useState<string | null>(null);
  const [verifyAttemptsCount, setVerifyAttemptsCount] = useState<number>(0);

  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      text: '/start',
      time: '12:01',
    },
    {
      id: 'msg-2',
      sender: 'bot',
      text: '👋 Welcome!\n🔒 Please join our Telegram channel first to unlock your link.',
      time: '12:01',
      buttons: [
        {
          label: '📢 JOIN CHANNEL',
          type: 'url',
          url: JOIN_CHANNEL_URL,
        },
        {
          label: '✅ VERIFY JOIN',
          type: 'callback',
          callbackData: 'verify_join',
        },
      ],
    },
  ]);

  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([
    {
      id: 'log-init',
      timestamp: '12:01:02',
      method: 'CommandHandler(/start)',
      statusReturned: 'Sent welcome message + 2 inline buttons',
      passed: true,
    },
  ]);

  const projectFiles: ProjectFile[] = useMemo(() => {
    const botPyContent = buildBotPyContent(customChannelId);
    return [
      {
        filename: 'bot.py',
        language: 'Python 3.11+',
        description:
          'Main Telegram bot using python-telegram-bot v21.10 with polling, getChatMember verification on every click, automatic channel ID detection, and global error handling.',
        lines: botPyContent.split('\n').length,
        sizeLabel: `${(new Blob([botPyContent]).size / 1024).toFixed(1)} KB`,
        content: botPyContent,
      },
      {
        filename: 'requirements.txt',
        language: 'Pip Dependencies',
        description:
          'Specifies python-telegram-bot==21.10 for Railway automatic Python environment installation.',
        lines: 1,
        sizeLabel: '28 B',
        content: REQUIREMENTS_TXT_CONTENT,
      },
      {
        filename: 'Procfile',
        language: 'Railway Processfile',
        description:
          'Instructs Railway to run the bot continuously as a background worker using polling (no webhook needed).',
        lines: 1,
        sizeLabel: '22 B',
        content: PROCFILE_CONTENT,
      },
    ];
  }, [customChannelId]);

  const activeFile = projectFiles[selectedFileIndex];

  const handleCopyFile = async (file: ProjectFile) => {
    try {
      await navigator.clipboard.writeText(file.content);
      setCopiedFile(file.filename);
      setTimeout(() => setCopiedFile(null), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = file.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedFile(file.filename);
      setTimeout(() => setCopiedFile(null), 2200);
    }
  };

  const handleDownloadFile = (file: ProjectFile) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllFiles = () => {
    projectFiles.forEach((file, index) => {
      setTimeout(() => {
        handleDownloadFile(file);
      }, index * 250);
    });
  };

  const getNowTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  const getNowTimestamp = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 8);
  };

  const showTemporaryToast = (text: string) => {
    setToastAlert(text);
    setTimeout(() => {
      setToastAlert((prev) => (prev === text ? null : prev));
    }, 3500);
  };

  const handleSimulateStart = () => {
    const time = getNowTime();
    const userMsg: SimMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: '/start',
      time,
    };
    const botMsg: SimMessage = {
      id: `bot-${Date.now() + 1}`,
      sender: 'bot',
      text: '👋 Welcome!\n🔒 Please join our Telegram channel first to unlock your link.',
      time,
      buttons: [
        {
          label: '📢 JOIN CHANNEL',
          type: 'url',
          url: JOIN_CHANNEL_URL,
        },
        {
          label: '✅ VERIFY JOIN',
          type: 'callback',
          callbackData: 'verify_join',
        },
      ],
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setApiLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: getNowTimestamp(),
        method: 'CommandHandler(/start)',
        statusReturned: 'Sent welcome message + inline buttons',
        passed: true,
      },
      ...prev.slice(0, 7),
    ]);
  };

  const handleSimulateVerify = () => {
    const time = getNowTime();
    const timestamp = getNowTimestamp();
    setVerifyAttemptsCount((prev) => prev + 1);

    if (!isBotAdminInChannel) {
      const adminErr =
        '⚠️ Channel Admin Required: Please make sure this bot is added as an Administrator in the verification channel.';
      showTemporaryToast(adminErr);
      setApiLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp,
          method: 'getChatMember(chat_id, user_id)',
          statusReturned: 'BadRequest: member list is inaccessible (Bot not Admin)',
          passed: false,
        },
        ...prev.slice(0, 7),
      ]);
      return;
    }

    if (!isUserJoinedChannel) {
      const notJoinedText = '❌ You have not joined our channel yet. Please join first!';
      showTemporaryToast(notJoinedText);

      const failBotMsg: SimMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: notJoinedText,
        time,
        buttons: [
          {
            label: '📢 JOIN CHANNEL',
            type: 'url',
            url: JOIN_CHANNEL_URL,
          },
          {
            label: '✅ VERIFY JOIN',
            type: 'callback',
            callbackData: 'verify_join',
          },
        ],
      };

      setMessages((prev) => [...prev, failBotMsg]);
      setApiLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp,
          method: 'getChatMember(chat_id, user_id)',
          statusReturned: 'ChatMember.status = "left" (Second link hidden)',
          passed: false,
        },
        ...prev.slice(0, 7),
      ]);
    } else {
      showTemporaryToast('✅ Verification Successful!');
      const successBotMsg: SimMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: '🎉 Verification Successful!\nHere is your requested link:',
        time,
        buttons: [
          {
            label: '🔓 OPEN LINK',
            type: 'url',
            url: UNLOCKED_LINK_URL,
          },
        ],
      };

      setMessages((prev) => [...prev, successBotMsg]);
      setApiLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp,
          method: 'getChatMember(chat_id, user_id)',
          statusReturned: 'ChatMember.status = "member" (Unlocked second link)',
          passed: true,
        },
        ...prev.slice(0, 7),
      ]);
    }
  };

  const handleResetSimulator = () => {
    setIsUserJoinedChannel(false);
    setIsBotAdminInChannel(true);
    setToastAlert(null);
    setVerifyAttemptsCount(0);
    setMessages([
      {
        id: 'msg-reset-1',
        sender: 'user',
        text: '/start',
        time: getNowTime(),
      },
      {
        id: 'msg-reset-2',
        sender: 'bot',
        text: '👋 Welcome!\n🔒 Please join our Telegram channel first to unlock your link.',
        time: getNowTime(),
        buttons: [
          {
            label: '📢 JOIN CHANNEL',
            type: 'url',
            url: JOIN_CHANNEL_URL,
          },
          {
            label: '✅ VERIFY JOIN',
            type: 'callback',
            callbackData: 'verify_join',
          },
        ],
      },
    ]);
    setApiLogs([
      {
        id: 'log-reset',
        timestamp: getNowTimestamp(),
        method: 'CommandHandler(/start)',
        statusReturned: 'Simulator reset to initial /start state',
        passed: true,
      },
    ]);
  };

  const toggleStepCompleted = (stepNumber: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [stepNumber]: !prev[stepNumber],
    }));
  };

  const completedCount = Object.values(completedSteps).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-[#0F172A]/95 backdrop-blur border-b border-slate-800 px-6 py-3.5">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8">
          <a
            href="#files"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Telegram VerifyBot Studio
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <a
              href="#files"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Project Files
            </a>
            <a
              href="#simulator"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Live Bot Simulator
            </a>
            <a
              href="#channel-admin"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Channel Admin Guide
            </a>
            <a
              href="#android-deploy"
              className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Android Railway Guide
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              onClick={handleDownloadAllFiles}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download All 3 Files
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-10 space-y-16">
        {/* Hero & Summary Strip */}
        <section className="space-y-6 border-b border-slate-800 pb-10">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-medium text-sky-400 tracking-wide">
              Python 3.11+ · python-telegram-bot 21.10 · Long Polling · Railway Worker Ready
            </p>
            <h1
              className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Complete Telegram Channel Join Verification Bot
            </h1>
            <p className="text-base text-slate-300 leading-relaxed">
              Your complete, ready-to-deploy Python project is generated below. Every time a user taps{' '}
              <span className="text-white font-medium">VERIFY JOIN</span>, the bot calls Telegram’s{' '}
              <code className="font-mono text-xs text-sky-300">getChatMember</code> API in real time to verify they
              joined your first channel before unlocking your second link.
            </p>
          </div>

          {/* Unboxed specification summary row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 text-sm">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Required Join Channel URL</div>
              <a
                href={JOIN_CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-sky-400 hover:underline inline-flex items-center gap-1.5 break-all"
              >
                {JOIN_CHANNEL_URL}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Unlocked Link (Members Only)</div>
              <a
                href={UNLOCKED_LINK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-emerald-400 hover:underline inline-flex items-center gap-1.5 break-all"
              >
                {UNLOCKED_LINK_URL}
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Environment Variable</div>
              <div className="font-mono text-xs text-slate-200">
                BOT_TOKEN <span className="text-slate-500">·</span> Never hardcoded
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-400">Connection Mode</div>
              <div className="font-mono text-xs text-slate-200">
                run_polling() <span className="text-slate-500">·</span> Zero webhooks
              </div>
            </div>
          </div>
        </section>

        {/* Main 2-Column Workspace: Complete Project Files (Left) + Live Bot Simulator (Right) */}
        <section id="files" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 Columns: Complete Code Files */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  1. Complete Project Files
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Tap Copy Code or Download on each file below to upload them to GitHub from your Android phone.
                </p>
              </div>

              {/* Interactive file selector tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg self-start">
                {projectFiles.map((file, idx) => (
                  <button
                    key={file.filename}
                    onClick={() => setSelectedFileIndex(idx)}
                    className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedFileIndex === idx
                        ? 'bg-sky-400 text-slate-950 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {file.filename}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Channel ID Helper Bar */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <label htmlFor="channel-id-input" className="text-xs font-semibold text-slate-200 block">
                    Optional: Pre-fill Your Channel ID (Or let the bot detect it automatically)
                  </label>
                  <p className="text-xs text-slate-400">
                    The bot automatically detects your channel when you make it Admin or forward a post from the channel to the bot.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    id="channel-id-input"
                    type="text"
                    value={customChannelId}
                    onChange={(e) => setCustomChannelId(e.target.value)}
                    placeholder="-1001234567890"
                    className="w-44 px-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                  />
                  {customChannelId && (
                    <button
                      onClick={() => setCustomChannelId('')}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Code Box */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-950/70 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <span className="text-white font-semibold">{activeFile.filename}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeFile.language}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeFile.lines} lines</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeFile.sizeLabel}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopyFile(activeFile)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedFile === activeFile.filename ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy {activeFile.filename}</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDownloadFile(activeFile)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-300">
                {activeFile.description}
              </div>

              <div className="max-h-[540px] overflow-y-auto p-4 bg-[#0B1120] font-mono text-xs leading-relaxed text-slate-200 select-all">
                <pre className="overflow-x-auto">
                  <code>{activeFile.content}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Right 5 Columns: Interactive Telegram Bot Simulator */}
          <div id="simulator" className="lg:col-span-5 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  2. Interactive Bot Simulator
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Test how your bot verifies channel membership before and after joining.
                </p>
              </div>
              <button
                onClick={handleResetSimulator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Chat
              </button>
            </div>

            {/* Membership State Controls */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs font-medium text-slate-300">
                  Simulated User Channel Status:
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <button
                    onClick={() => setIsUserJoinedChannel(false)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      !isUserJoinedChannel
                        ? 'bg-rose-500/20 text-rose-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Not Joined
                  </button>
                  <button
                    onClick={() => setIsUserJoinedChannel(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isUserJoinedChannel
                        ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Joined Channel
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-medium text-slate-300">
                  Bot Added as Channel Admin:
                </div>
                <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                  <button
                    onClick={() => setIsBotAdminInChannel(true)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isBotAdminInChannel
                        ? 'bg-sky-500/20 text-sky-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Admin Enabled
                  </button>
                  <button
                    onClick={() => setIsBotAdminInChannel(false)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      !isBotAdminInChannel
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Not Admin
                  </button>
                </div>
              </div>
            </div>

            {/* Simulated Telegram Chat Window */}
            <div className="rounded-xl bg-[#0E1621] border border-slate-800 overflow-hidden flex flex-col">
              {/* Telegram Header */}
              <div className="px-4 py-3 bg-[#17212B] border-b border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Channel Join Verification Bot</div>
                  <div className="text-xs text-sky-400">bot · polling active</div>
                </div>
                <div className="text-xs text-slate-400 font-mono tabular-nums">
                  Checks: {verifyAttemptsCount}
                </div>
              </div>

              {/* Callback Query Popup Alert Banner */}
              {toastAlert && (
                <div className="px-4 py-2.5 bg-slate-950/95 border-b border-slate-800 text-xs text-amber-200 flex items-center justify-between gap-2">
                  <span>{toastAlert}</span>
                  <button
                    onClick={() => setToastAlert(null)}
                    className="text-xs text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    OK
                  </button>
                </div>
              )}

              {/* Messages Feed */}
              <div className="p-4 space-y-3 h-[340px] overflow-y-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-[#2B5278] text-white'
                          : 'bg-[#182533] text-slate-100'
                      }`}
                    >
                      <div>{msg.text}</div>
                      <div className="text-[10px] text-slate-400 text-right mt-1 font-mono tabular-nums">
                        {msg.time}
                      </div>
                    </div>

                    {/* Inline Keyboard Markup */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="w-full max-w-[88%] mt-1.5 space-y-1.5">
                        {msg.buttons.map((btn, idx) =>
                          btn.type === 'url' ? (
                            <a
                              key={idx}
                              href={btn.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (btn.url === JOIN_CHANNEL_URL) {
                                  setIsUserJoinedChannel(true);
                                  showTemporaryToast(
                                    '📢 Opened channel link! Simulated status switched to "Joined Channel". Now tap ✅ VERIFY JOIN.'
                                  );
                                }
                              }}
                              className="w-full py-2 px-3 rounded-lg bg-[#203040] hover:bg-[#283B4F] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <span>{btn.label}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <button
                              key={idx}
                              onClick={handleSimulateVerify}
                              className="w-full py-2 px-3 rounded-lg bg-[#203040] hover:bg-[#283B4F] text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <span>{btn.label}</span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Command Bar */}
              <div className="px-3 py-2.5 bg-[#17212B] border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={handleSimulateStart}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-[#2B5278] hover:bg-[#34628E] text-white rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send /start
                </button>
                <button
                  onClick={handleSimulateVerify}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Tap ✅ VERIFY JOIN
                </button>
              </div>
            </div>

            {/* Real-time API Verification Log */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200 inline-flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  Telegram Bot API Inspector
                </span>
                <span className="font-mono">bot.get_chat_member()</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {apiLogs.slice(0, 3).map((entry) => (
                  <div
                    key={entry.id}
                    className="py-1.5 border-b border-slate-800/70 last:border-none flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{entry.method}</span>
                      <span className="tabular-nums">{entry.timestamp}</span>
                    </div>
                    <div
                      className={
                        entry.passed ? 'text-emerald-400 text-[11px]' : 'text-rose-400 text-[11px]'
                      }
                    >
                      {entry.statusReturned}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: How to Add the Bot as an Administrator to the Verification Channel */}
        <section id="channel-admin" className="space-y-6 border-t border-slate-800 pt-12">
          <div className="max-w-3xl space-y-2">
            <h2 className="font-display text-2xl font-bold text-white">
              3. How to Add Your Bot as an Administrator in Your Verification Channel
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Because your channel (<code className="font-mono text-xs text-sky-300">{JOIN_CHANNEL_URL}</code>) uses a
              private invite link, Telegram requires your bot to be an{' '}
              <span className="text-white font-semibold">Administrator</span> inside that channel so{' '}
              <code className="font-mono text-xs text-sky-300">getChatMember</code> can check whether a user has
              joined. Follow these exact steps on your Android phone:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono text-sky-400">01. Open Channel Settings</div>
              <h3 className="font-display text-base font-semibold text-white">
                Open Your Verification Channel
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Open your first Telegram channel (<code className="font-mono text-xs">https://t.me/+maKoLPmHtag0ZDFl</code>)
                in the Telegram Android app and tap the <span className="text-white font-medium">Channel Name</span> at
                the very top bar.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono text-sky-400">02. Promote Bot to Admin</div>
              <h3 className="font-display text-base font-semibold text-white">
                Tap Administrators → Add Admin
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tap <span className="text-white font-medium">Administrators</span>, then tap{' '}
                <span className="text-white font-medium">Add Admin</span>. Tap the magnifying glass icon in the
                top-right corner and type your bot’s <code className="font-mono text-xs">@username</code>.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="text-xs font-mono text-sky-400">03. Save & Auto-Detect Channel ID</div>
              <h3 className="font-display text-base font-semibold text-white">
                Tap the Checkmark (✓) in Top-Right
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Tap your bot, leave default admin permissions on, and tap the{' '}
                <span className="text-white font-medium">Checkmark (✓)</span>. As soon as your bot is running on
                Railway, it automatically detects your channel ID—or you can forward any message from your channel to
                the bot in private chat!
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Beginner-Friendly Android Phone Deployment Guide (GitHub + Railway) */}
        <section id="android-deploy" className="space-y-6 border-t border-slate-800 pt-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <h2 className="font-display text-2xl font-bold text-white">
                4. Step-by-Step Deployment Guide for Android Phone (GitHub + Railway)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                No computer or coding knowledge required. You can complete every step below using the Telegram app and
                Chrome browser on your Android phone. Tap each step as you finish it to track your progress.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
              Completed: {completedCount} / {ANDROID_DEPLOYMENT_STEPS.length} steps
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ANDROID_DEPLOYMENT_STEPS.map((step) => {
              const isDone = Boolean(completedSteps[step.number]);
              return (
                <div
                  key={step.number}
                  className={`p-6 rounded-xl border transition-colors flex flex-col justify-between gap-5 ${
                    isDone
                      ? 'bg-slate-900/60 border-emerald-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-400 font-mono">
                          Step {step.number} <span aria-hidden="true">·</span> {step.phase}{' '}
                          <span aria-hidden="true">·</span> {step.duration}
                        </div>
                        <h3 className="font-display text-lg font-bold text-white">
                          {step.title}
                        </h3>
                      </div>

                      <button
                        onClick={() => toggleStepCompleted(step.number)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isDone
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isDone ? '✓ Completed' : 'Mark Done'}
                      </button>
                    </div>

                    <ol className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside leading-relaxed">
                      {step.instructions.map((line, i) => (
                        <li key={i} className="pl-1">
                          {line}
                        </li>
                      ))}
                    </ol>
                  </div>

                  {step.importantNote && (
                    <div className="pt-3 border-t border-slate-800 text-xs text-amber-300/90 leading-relaxed">
                      <span className="font-semibold">Tip: </span>
                      {step.importantNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-6 px-6 mt-12">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-sky-400" />
            <span>Designed for zero-code Android deployment to GitHub & Railway</span>
          </div>
          <div className="font-mono">
            bot.py · requirements.txt · Procfile
          </div>
        </div>
      </footer>
    </div>
  );
}
