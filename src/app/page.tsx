"use client";
import { useState, useRef, useEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";
import ThemeSelector from "./ThemeSelector";
import PlayPauseButton from "./PlayPauseButton";
import PrevButton from "./PrevButton";
import NextButton from "./NextButton";
import FileTree, { FileNode } from "./FileTree";
import PlaybackSpeedSelector from "./PlaybackSpeedSelector";

function parseRepoUrl(input: string): { owner: string, repo: string } | null {
  const urlPattern = /github\.com\/(.+?)\/(.+?)(?:\.git|\/|$)/i;
  const shortPattern = /^([\w-]+)\/([\w.-]+)$/;
  let match = input.match(urlPattern);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  match = input.match(shortPattern);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return null;
}

type TreeItem = { path: string; type: string };

async function fetchFiles(owner: string, repo: string, branch: string, token: string): Promise<string[] | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Blacklist of common binary file extensions
  const binaryExts = [
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".pdf", ".exe", ".dll", ".so", ".dylib", ".zip", ".tar", ".gz", ".rar", ".7z", ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".mkv", ".webm", ".ogg", ".wav", ".class", ".jar", ".bin", ".obj", ".o", ".a", ".lib", ".ttf", ".woff", ".woff2", ".eot", ".psd", ".ai", ".sketch", ".xcf", ".svgz", ".apk", ".ipa", ".pdb", ".ds_store"
  ];
  return (data.tree || [])
    .filter((item: TreeItem) =>
      item.type === "blob" &&
      !binaryExts.some(ext => item.path.toLowerCase().endsWith(ext))
    )
    .map((item: TreeItem) => item.path);
}

async function fetchFileContent(owner: string, repo: string, path: string, branch: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  console.log('[fetchFileContent] Fetching:', url, 'for path:', path);
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) {
    let errorMsg = '';
    try {
      const data = await res.json();
      errorMsg = data.message || '';
    } catch {}
    console.error(`[fetchFileContent] Failed to fetch ${path}: status=${res.status} ${res.statusText} message=${errorMsg}`);
    return null;
  }
  const data = await res.json();
  if (data.encoding === "base64" && typeof data.content === "string") {
    try {
      return atob(data.content.replace(/\n/g, ""));
    } catch (e) {
      console.error(`[fetchFileContent] Failed to decode base64 for ${path}:`, e);
      return null;
    }
  }
  return null;
}

// Utility to guess language from file extension
function getLanguageFromFilename(filename: string): Language | undefined {
  if (filename.endsWith(".py")) return "python";
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".html")) return "markup";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".md")) return "markdown";
  if (filename.endsWith(".java")) return "java";
  if (filename.endsWith(".c")) return "c";
  if (filename.endsWith(".cpp")) return "cpp";
  if (filename.endsWith(".xml")) return "markup";
  if (filename.endsWith(".yml") || filename.endsWith(".yaml")) return "yaml";
  if (filename.endsWith(".go")) return "go";
  return undefined;
}

// Utility: Convert flat file list to tree structure
function buildFileTree(paths: string[]): FileNode[] {
  const root: { [key: string]: FileNode } = {};
  paths.forEach(path => {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          type: i === parts.length - 1 ? "file" : "folder",
          children: i === parts.length - 1 ? undefined : {},
        };
      }
      if (i < parts.length - 1) {
        current = current[part].children!;
      }
    }
  });
  function toArray(obj: { [key: string]: FileNode }): FileNode[] {
    return Object.values(obj).map(node =>
      node.type === "folder"
        ? { ...node, children: toArray(node.children!) }
        : node
    );
  }
  return toArray(root);
}

// Flattens a FileNode tree into a list of file paths in depth-first, folders-before-files order
function flattenFileTree(nodes: FileNode[]): string[] {
  let result: string[] = [];
  for (const node of nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'folder' ? -1 : 1;
  })) {
    if (node.type === "file") {
      result.push(node.path);
    } else if (node.type === "folder" && Array.isArray(node.children)) {
      result = result.concat(flattenFileTree(node.children));
    }
  }
  return result;
}

export default function Home() {
  const [repoInput, setRepoInput] = useState("");
  const [files, setFiles] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [branchUsed, setBranchUsed] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<{ owner: string, repo: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollRef = useRef<HTMLPreElement | null>(null);
  const scrollInterval = useRef<NodeJS.Timeout | null>(null);
  const [nextFileCache, setNextFileCache] = useState<{ path: string, content: string } | null>(null);
  // Resizable left pane state
  const [leftWidth, setLeftWidth] = useState(300); // px
  const minLeftWidth = 180;
  const maxLeftWidth = 600;
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startWidth = useRef(0);
  // Ref for Play/Pause button
  const playPauseBtnRef = useRef<HTMLButtonElement | null>(null);
  // Fullscreen code view
  const codeViewRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Prism theme selection using only themes from the imported 'themes' object
  const prismThemes = [
    { name: "Dracula", value: "dracula" },
    { name: "Duotone Dark", value: "duotoneDark" },
    { name: "Gruvbox Material Dark", value: "gruvboxMaterialDark" },
    { name: "Jettwave Dark", value: "jettwaveDark" },
    { name: "Night Owl", value: "nightOwl" },
    { name: "Oceanic Next", value: "oceanicNext" },
    { name: "Okaidia", value: "okaidia" },
    { name: "One Dark", value: "oneDark" },
    { name: "Palenight", value: "palenight" },
    { name: "Shades of Purple", value: "shadesOfPurple" },
    { name: "Synthwave 84", value: "synthwave84" },
    { name: "VS Dark", value: "vsDark" },
  ];
  const [selectedTheme, setSelectedTheme] = useState("dracula");
  const [showSettings, setShowSettings] = useState(false);
  const [githubToken, setGithubToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('githubToken') || "";
    }
    return "";
  });
  const filePathContainerRef = useRef<HTMLSpanElement | null>(null);
  const scrollDirRef = useRef<'left' | 'right'>('left');
  // Add state for vertical transition
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextFileForTransition, setNextFileForTransition] = useState<string | null>(null);
  const transitionContainerRef = useRef<HTMLDivElement | null>(null);
  // Add state to track which file is being loaded
  const [loadingFilePath, setLoadingFilePath] = useState<string | null>(null);
  // Add playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackSpeedOptions = [0.5, 1, 1.5, 2];

  // Helper to set user-select on body
  function setBodyUserSelect(value: string) {
    document.body.style.userSelect = value;
    // For Safari
    (document.body.style as any).webkitUserSelect = value;
  }

  // Mouse event handlers for resizing
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      const newWidth = Math.min(
        maxLeftWidth,
        Math.max(minLeftWidth, startWidth.current + (e.clientX - startX.current))
      );
      setLeftWidth(newWidth);
    }
    function onMouseUp() {
      setDragging(false);
      document.body.style.cursor = '';
      setBodyUserSelect('');
    }
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      setBodyUserSelect('none');
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      setBodyUserSelect('');
    };
  }, [dragging]);

  // Auto-scroll effect
  useEffect(() => {
    if (!isPlaying || fileContent === null) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollStep = 1; // px per tick
    const baseDelay = 20; // ms per tick at 1x
    const scrollDelay = baseDelay / playbackSpeed;
    let finished = false;
    function scrollDown() {
      if (!el) return;
      // If file is empty or fits on one screen, wait 1s and move next
      if (fileContent === '' || el.scrollHeight <= el.clientHeight + 2) {
        if (!finished) {
          finished = true;
          const moveNext = () => {
            if (files && selectedFile) {
              const orderedFiles = flattenFileTree(buildFileTree(files));
              const idx = orderedFiles.indexOf(selectedFile);
              if (idx !== -1 && idx + 1 < orderedFiles.length) {
                const nextPath = orderedFiles[idx + 1];
                // Wait for nextFileCache to be ready
                if (nextFileCache && nextFileCache.path === nextPath) {
                  setNextFileForTransition(nextPath);
                  setIsTransitioning(true);
                  setTimeout(() => {
                    setIsTransitioning(false);
                    setNextFileForTransition(null);
                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                    setSelectedFile(nextPath);
                    setFileContent(nextFileCache.content);
                  }, 1000); // 1s transition
                } else {
                  // Wait and retry
                  setTimeout(moveNext, 100);
                }
              } else {
                setIsPlaying(false);
              }
            } else {
              setIsPlaying(false);
            }
          };
          setTimeout(moveNext, 1000);
        }
        return;
      }
      if (el.scrollTop + el.clientHeight < el.scrollHeight) {
        el.scrollTop += scrollStep;
      } else if (!finished) {
        finished = true;
        const moveNext = () => {
          if (files && selectedFile) {
            const orderedFiles = flattenFileTree(buildFileTree(files));
            const idx = orderedFiles.indexOf(selectedFile);
            if (idx !== -1 && idx + 1 < orderedFiles.length) {
              const nextPath = orderedFiles[idx + 1];
              // Wait for nextFileCache to be ready
              if (nextFileCache && nextFileCache.path === nextPath) {
                setNextFileForTransition(nextPath);
                setIsTransitioning(true);
                setTimeout(() => {
                  setIsTransitioning(false);
                  setNextFileForTransition(null);
                  if (scrollRef.current) scrollRef.current.scrollTop = 0;
                  setSelectedFile(nextPath);
                  setFileContent(nextFileCache.content);
                }, 1000); // 1s transition
              } else {
                // Wait and retry
                setTimeout(moveNext, 100);
              }
            } else {
              setIsPlaying(false);
            }
          } else {
            setIsPlaying(false);
          }
        };
        setTimeout(moveNext, 500);
      }
    }
    scrollInterval.current = setInterval(scrollDown, scrollDelay);
    return () => {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    };
  }, [isPlaying, fileContent, files, selectedFile, nextFileCache, playbackSpeed]);

  // Reset scroll on new file
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [fileContent]);

  // Preload next file content
  useEffect(() => {
    if (!files || !selectedFile || !repoInfo || !branchUsed) {
      setNextFileCache(null);
      return;
    }
    const orderedFiles = flattenFileTree(buildFileTree(files));
    const idx = orderedFiles.indexOf(selectedFile);
    if (idx === -1 || idx + 1 >= orderedFiles.length) {
      setNextFileCache(null);
      return;
    }
    const nextPath = orderedFiles[idx + 1];
    let cancelled = false;
    fetchFileContent(repoInfo.owner, repoInfo.repo, nextPath, branchUsed, githubToken).then(content => {
      if (!cancelled && content !== null) {
        setNextFileCache({ path: nextPath, content });
      }
    });
    return () => { cancelled = true; };
  }, [files, selectedFile, repoInfo, branchUsed, githubToken]);

  // Play/Pause with Space shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && selectedFile && !fileLoading && !fileError) {
        e.preventDefault();
        setIsPlaying(p => !p);
        // Focus the Play/Pause button
        playPauseBtnRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedFile, fileLoading, fileError]);

  const handleFetchFiles = async () => {
    setError(null);
    setFiles(null);
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
    setBranchUsed(null);
    setNextFileCache(null);
    if (!githubToken || githubToken.trim() === "") {
      setError("GitHub personal token is required. Please set it in settings (⚙️) below.");
      return;
    }
    const info = parseRepoUrl(repoInput.trim());
    if (!info) {
      setError("Invalid repo URL or format. Use https://github.com/owner/repo or owner/repo.");
      return;
    }
    setRepoInfo(info);
    setLoading(true);
    // Try master, then main
    let fileList = await fetchFiles(info.owner, info.repo, "master", githubToken);
    let branch = "master";
    if (!fileList) {
      fileList = await fetchFiles(info.owner, info.repo, "main", githubToken);
      branch = "main";
    }
    setLoading(false);
    if (!fileList) {
      setError("Could not fetch files. Check repo and token.");
      return;
    }
    setFiles(fileList);
    setBranchUsed(branch);
  };

  // Auto-select and play the first file when files, repoInfo, and branchUsed are set
  useEffect(() => {
    if (files && files.length > 0 && repoInfo && branchUsed && !selectedFile) {
      const orderedFiles = flattenFileTree(buildFileTree(files));
      if (orderedFiles.length > 0) {
        handleSelectFile(orderedFiles[0], true);
      }
    }
  }, [files, repoInfo, branchUsed, selectedFile]);

  // Update handleSelectFile to use loadingFilePath and only update fileContent after loading
  const handleSelectFile = async (file: string, autoPlay = false, useCache = false, isTransition = false) => {
    if (!repoInfo || !branchUsed) return;
    if (!githubToken || githubToken.trim() === "") {
      setFileError("GitHub personal token is required. Please set it in settings (⚙️) below.");
      setIsPlaying(false);
      return;
    }
    if (isTransition) {
      setLoadingFilePath(file);
      return;
    }
    setFileError(null);
    setFileLoading(true);
    setIsPlaying(autoPlay);
    if (useCache && nextFileCache && nextFileCache.path === file) {
      setSelectedFile(file);
      setFileContent(nextFileCache.content);
      setFileLoading(false);
      setLoadingFilePath(null);
      return;
    }
    const content = await fetchFileContent(repoInfo.owner, repoInfo.repo, file, branchUsed, githubToken);
    setFileLoading(false);
    setLoadingFilePath(null);
    if (content === null) {
      setFileError("Could not fetch file content.");
      setIsPlaying(false);
      return;
    }
    setSelectedFile(file);
    setFileContent(content);
  };

  // Keyboard accessibility for file list
  const handleFileKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, file: string) => {
    if (e.key === "Enter" || e.key === " ") {
      handleSelectFile(file);
    }
  };

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Save token to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('githubToken', githubToken);
    }
  }, [githubToken]);

  // Animate file path scrolling if it overflows
  useEffect(() => {
    const el = filePathContainerRef.current;
    if (!el || !selectedFile) return;
    let animId: number | null = null;
    const speed = 0.4; // px per frame (slower)
    const delay = 1000; // ms to pause at each end

    // Only set scrollLeft and direction on file change
    el.scrollLeft = el.scrollWidth - el.clientWidth;
    scrollDirRef.current = 'left';

    function animate() {
      if (!el) return;
      if (el.scrollWidth <= el.clientWidth) return;
      if (scrollDirRef.current === 'left') {
        if (el.scrollLeft > 0) {
          el.scrollLeft -= speed;
          animId = requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            scrollDirRef.current = 'right';
            animId = requestAnimationFrame(animate);
          }, delay);
        }
      } else {
        if (el.scrollLeft + el.clientWidth < el.scrollWidth) {
          el.scrollLeft += speed;
          animId = requestAnimationFrame(animate);
        } else {
          setTimeout(() => {
            scrollDirRef.current = 'left';
            animId = requestAnimationFrame(animate);
          }, delay);
        }
      }
    }
    animId = requestAnimationFrame(animate);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [selectedFile]);

  const orderedFiles = files ? flattenFileTree(buildFileTree(files)) : [];
  const currentIndex = selectedFile ? orderedFiles.indexOf(selectedFile) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < orderedFiles.length - 1;
  const handlePrev = () => {
    if (hasPrev) {
      handleSelectFile(orderedFiles[currentIndex - 1], true);
    }
  };
  const handleNext = () => {
    if (hasNext) {
      handleSelectFile(orderedFiles[currentIndex + 1], true);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black">
      <div className="flex flex-1 w-screen h-screen gap-0" style={{ minHeight: '100vh' }}>
        {/* Left pane: resizable */}
        <div
          className="flex flex-col bg-zinc-900 border-r border-zinc-700 p-4"
          style={{ width: leftWidth, height: '100vh', maxHeight: '100vh', minWidth: minLeftWidth, maxWidth: maxLeftWidth }}
        >
          <div className="flex flex-col gap-2 mb-4">
            <input
              id="repo"
              type="text"
              className="border rounded px-3 py-2 text-lg bg-zinc-900 text-white placeholder-gray-400 border-zinc-700"
              placeholder="GitHub Repo URL"
              value={repoInput}
              onChange={e => setRepoInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !loading && repoInput.trim()) {
                  handleFetchFiles();
                }
              }}
            />
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700 disabled:opacity-50"
              onClick={handleFetchFiles}
              disabled={loading || !repoInput.trim()}
            >
              {loading ? "Loading..." : "Sync"}
            </button>
            {error && <div className="text-red-400 mt-2">{error}</div>}
          </div>
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2 text-white">Files</h2>
            {files ? (
              <FileTree
                nodes={buildFileTree(files)}
                selectedFile={selectedFile}
                onSelect={file => handleSelectFile(file, true)}
              />
            ) : (
              <div className="italic text-gray-400">No files loaded.</div>
            )}
          </div>
        </div>
        {/* Divider */}
        <div
          style={{ width: 6, cursor: 'col-resize', zIndex: 10 }}
          className="bg-zinc-800 hover:bg-zinc-700 transition-colors duration-100"
          onMouseDown={e => {
            e.preventDefault(); // Prevent text selection
            setDragging(true);
            startX.current = e.clientX;
            startWidth.current = leftWidth;
          }}
        />
        {/* Right pane: 5/6 width */}
        <div
          ref={codeViewRef}
          className="flex-1 border-l border-zinc-700 bg-zinc-900 p-4 flex flex-col h-screen min-h-0 overflow-x-hidden"
          style={isFullscreen ? { zIndex: 50, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', border: 'none', borderRadius: 0 } : {}}
        >
          <div className="flex-1 min-h-0 overflow-y-auto" style={{ position: 'relative', height: '100%' }}>
            <div
              ref={transitionContainerRef}
              style={{
                height: '100%',
                width: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                transition: isTransitioning ? 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                transform: isTransitioning ? 'translateY(-100%)' : 'translateY(0%)',
                willChange: 'transform',
              }}
            >
              <div style={{ height: '100%', width: '100%' }}>
                {fileContent !== null && selectedFile && (
                  <Highlight
                    code={fileContent}
                    language={getLanguageFromFilename(selectedFile) || "text"}
                    theme={themes[selectedTheme]}
                  >
                    {({ className, style, tokens, getLineProps, getTokenProps }: {
                      className: string;
                      style: React.CSSProperties;
                      tokens: any[][];
                      getLineProps: (props: any) => any;
                      getTokenProps: (props: any) => any;
                    }) => (
                      <pre
                        ref={scrollRef}
                        className={`rounded p-4 whitespace-pre-wrap text-sm transition-all text-gray-100 h-full overflow-y-auto w-full ${className}`}
                        style={style}
                      >
                        {tokens.map((line, i) => {
                          const { key, ...lineProps } = getLineProps({ line, key: i });
                          return (
                            <div
                              key={i}
                              {...lineProps}
                              style={{ position: 'relative', paddingLeft: '3.5em' }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  width: '2.5em',
                                  userSelect: 'none',
                                  color: '#888',
                                  textAlign: 'right',
                                  paddingRight: '1em',
                                }}
                                className="select-none"
                              >
                                {i + 1}
                              </span>
                              {line.map((token, key) => {
                                const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key });
                                return <span key={key} {...tokenProps} />;
                              })}
                            </div>
                          );
                        })}
                      </pre>
                    )}
                  </Highlight>
                )}
              </div>
              {isTransitioning && nextFileForTransition && (
                <div style={{ height: '100%', width: '100%' }}>
                  <Highlight
                    code={nextFileCache && nextFileCache.path === nextFileForTransition ? nextFileCache.content : ''}
                    language={getLanguageFromFilename(nextFileForTransition) || "text"}
                    theme={themes[selectedTheme]}
                  >
                    {({ className, style, tokens, getLineProps, getTokenProps }: {
                      className: string;
                      style: React.CSSProperties;
                      tokens: any[][];
                      getLineProps: (props: any) => any;
                      getTokenProps: (props: any) => any;
                    }) => (
                      <pre
                        className={`rounded p-4 whitespace-pre-wrap text-sm transition-all text-gray-100 h-full overflow-y-auto w-full ${className}`}
                        style={style}
                      >
                        {tokens.map((line, i) => {
                          const { key, ...lineProps } = getLineProps({ line, key: i });
                          return (
                            <div
                              key={i}
                              {...lineProps}
                              style={{ position: 'relative', paddingLeft: '3.5em' }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  width: '2.5em',
                                  userSelect: 'none',
                                  color: '#888',
                                  textAlign: 'right',
                                  paddingRight: '1em',
                                }}
                                className="select-none"
                              >
                                {i + 1}
                              </span>
                              {line.map((token, key) => {
                                const { key: tokenKey, ...tokenProps } = getTokenProps({ token, key });
                                return <span key={key} {...tokenProps} />;
                              })}
                            </div>
                          );
                        })}
                      </pre>
                    )}
                  </Highlight>
                </div>
              )}
            </div>
            {fileError && selectedFile && <div className="text-red-400">{fileError}</div>}
            {!selectedFile && <div className="italic text-gray-500">No file selected. Select a file to start playing.</div>}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <span
              ref={filePathContainerRef}
              className="font-mono text-sm text-gray-300 flex-1"
              style={{
                display: 'block',
                position: 'relative',
                width: '100%',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE/Edge
              }}
              // Hide scrollbar for Webkit browsers
              css={{
                '::-webkit-scrollbar': { display: 'none' },
              }}
            >
              {selectedFile ? selectedFile : <span className="italic text-gray-500">No file selected</span>}
            </span>
            <PrevButton
              onClick={handlePrev}
              disabled={!hasPrev || fileLoading || !!fileError}
            />
            <PlayPauseButton
              isPlaying={isPlaying}
              onClick={() => setIsPlaying(p => !p)}
              disabled={!selectedFile || fileLoading || !!fileError}
              buttonRef={playPauseBtnRef}
            />
            <NextButton
              onClick={handleNext}
              disabled={!hasNext || fileLoading || !!fileError}
            />
            <button
              type="button"
              className="px-2 py-1 rounded bg-zinc-700 text-white ml-2 hover:bg-zinc-600"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              onClick={async () => {
                if (!isFullscreen && codeViewRef.current) {
                  await codeViewRef.current.requestFullscreen();
                } else if (isFullscreen && document.fullscreenElement) {
                  await document.exitFullscreen();
                }
              }}
            >
              {isFullscreen ? "⤫" : "⛶"}
            </button>
            <ThemeSelector
              value={selectedTheme}
              onChange={setSelectedTheme}
              options={prismThemes}
            />
            <PlaybackSpeedSelector
              value={playbackSpeed}
              onChange={setPlaybackSpeed}
              options={playbackSpeedOptions}
            />
            <button
              type="button"
              className="px-2 py-1 rounded bg-zinc-700 text-white ml-2 hover:bg-zinc-600"
              title="Settings"
              onClick={() => setShowSettings(true)}
            >
              ⚙️
            </button>
            {showSettings && (
              <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40">
                <div className="bg-zinc-800 p-6 rounded shadow-lg min-w-[520px] max-w-full w-[520px] relative">
                  <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-white"
                    onClick={() => setShowSettings(false)}
                    aria-label="Close settings"
                  >
                    ×
                  </button>
                  <h3 className="text-lg font-semibold mb-4 text-white">Settings</h3>
                  <label className="block text-gray-300 mb-2">GitHub Personal Token</label>
                  <input
                    type="text"
                    className="w-full border border-zinc-600 rounded px-3 py-2 bg-zinc-900 text-white mb-4 font-mono text-base"
                    value={githubToken}
                    onChange={e => setGithubToken(e.target.value)}
                    placeholder="Enter your GitHub token"
                    autoComplete="off"
                  />
                  <div className="text-xs text-gray-400 mb-2">Token is stored in your browser only.</div>
                  <button
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() => setShowSettings(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
