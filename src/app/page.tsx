"use client";
import { useState, useRef, useEffect } from "react";
import { Highlight, themes } from "prism-react-renderer";

const GITHUB_TOKEN = "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";

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
  const textExts = [
    ".txt", ".md", ".py", ".js", ".json", ".csv", ".html", ".css", ".ts", ".java", ".c", ".cpp", ".xml", ".yml", ".yaml", ".ini", ".cfg", ".log"
  ];
  return (data.tree || [])
    .filter((item: TreeItem) => item.type === "blob" && textExts.some(ext => item.path.endsWith(ext)))
    .map((item: TreeItem) => item.path);
}

async function fetchFileContent(owner: string, repo: string, path: string, branch: string, token: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    try {
      return atob(data.content.replace(/\n/g, ""));
    } catch {
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

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[] | { [key: string]: FileNode };
};

// Recursive tree view component
function FileTree({ nodes, selectedFile, onSelect }: {
  nodes: FileNode[];
  selectedFile: string | null;
  onSelect: (file: string) => void;
}) {
  const [openFolders, setOpenFolders] = useState<{ [path: string]: boolean }>({});

  // Helper to collect all folder paths recursively
  function collectFolderPaths(nodes: FileNode[], acc: Set<string>) {
    for (const node of nodes) {
      if (node.type === "folder") {
        acc.add(node.path);
        if (Array.isArray(node.children)) {
          collectFolderPaths(node.children, acc);
        }
      }
    }
  }

  // Expand all folders by default when nodes change
  useEffect(() => {
    const allFolders = new Set<string>();
    collectFolderPaths(nodes, allFolders);
    setOpenFolders(Object.fromEntries(Array.from(allFolders).map(path => [path, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <ul className="pl-4">
      {nodes
        .slice()
        .sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type === 'folder' ? -1 : 1;
        })
        .map(node => (
          <li key={node.path} className="break-all">
            {node.type === "folder" ? (
              <div>
                <button
                  type="button"
                  className="text-blue-200 font-bold bg-transparent border-none cursor-pointer mr-1"
                  onClick={() => toggleFolder(node.path)}
                  aria-label={openFolders[node.path] ? "Collapse folder" : "Expand folder"}
                >
                  {openFolders[node.path] ? "▼" : "▶"}
                </button>
                <span className="text-blue-200 font-bold">{node.name}</span>
                {openFolders[node.path] && node.children && (
                  <FileTree nodes={node.children as FileNode[]} selectedFile={selectedFile} onSelect={onSelect} />
                )}
              </div>
            ) : (
              <button
                type="button"
                className={`text-blue-400 hover:underline cursor-pointer bg-transparent border-none p-0 m-0 text-left ${selectedFile === node.path ? "font-bold text-green-400" : ""}`}
                onClick={() => onSelect(node.path)}
                aria-pressed={selectedFile === node.path}
              >
                {node.name}
              </button>
            )}
          </li>
        ))}
    </ul>
  );
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
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Helper to set user-select on body
  function setBodyUserSelect(value: string) {
    document.body.style.userSelect = value;
    // For Safari
    (document.body.style as any).webkitUserSelect = value;
  }

  // Mouse event handlers for resizing
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current) return;
      const newWidth = Math.min(
        maxLeftWidth,
        Math.max(minLeftWidth, startWidth.current + (e.clientX - startX.current))
      );
      setLeftWidth(newWidth);
    }
    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = '';
      setBodyUserSelect('');
    }
    if (dragging.current) {
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
  }, [dragging.current]);

  // Auto-scroll effect
  useEffect(() => {
    if (!isPlaying || !fileContent) return;
    const el = scrollRef.current;
    if (!el) return;
    const scrollStep = 1; // px per tick
    const scrollDelay = 20; // ms per tick
    function scrollDown() {
      if (!el) return;
      if (el.scrollTop + el.clientHeight < el.scrollHeight) {
        el.scrollTop += scrollStep;
      } else {
        // End of file, go to next file if available
        setIsPlaying(false);
        if (files && selectedFile) {
          const idx = files.indexOf(selectedFile);
          if (idx !== -1 && idx + 1 < files.length) {
            setTimeout(() => {
              handleSelectFile(files[idx + 1], true, true);
            }, 500);
          }
        }
      }
    }
    scrollInterval.current = setInterval(scrollDown, scrollDelay);
    return () => {
      if (scrollInterval.current) clearInterval(scrollInterval.current);
    };
    // Only depend on isPlaying, fileContent, files, selectedFile
  }, [isPlaying, fileContent, files, selectedFile]);

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
    const idx = files.indexOf(selectedFile);
    if (idx === -1 || idx + 1 >= files.length) {
      setNextFileCache(null);
      return;
    }
    const nextPath = files[idx + 1];
    let cancelled = false;
    fetchFileContent(repoInfo.owner, repoInfo.repo, nextPath, branchUsed, GITHUB_TOKEN).then(content => {
      if (!cancelled && content !== null) {
        setNextFileCache({ path: nextPath, content });
      }
    });
    return () => { cancelled = true; };
  }, [files, selectedFile, repoInfo, branchUsed]);

  const handleFetchFiles = async () => {
    setError(null);
    setFiles(null);
    setSelectedFile(null);
    setFileContent(null);
    setFileError(null);
    setBranchUsed(null);
    setNextFileCache(null);
    const info = parseRepoUrl(repoInput.trim());
    if (!info) {
      setError("Invalid repo URL or format. Use https://github.com/owner/repo or owner/repo.");
      return;
    }
    setRepoInfo(info);
    setLoading(true);
    // Try master, then main
    let fileList = await fetchFiles(info.owner, info.repo, "master", GITHUB_TOKEN);
    let branch = "master";
    if (!fileList) {
      fileList = await fetchFiles(info.owner, info.repo, "main", GITHUB_TOKEN);
      branch = "main";
    }
    setLoading(false);
    if (!fileList) {
      setError("Could not fetch files. Check repo and token.");
      return;
    }
    setFiles(fileList);
    setBranchUsed(branch);
    // Auto-select and play the first file if available
    if (fileList.length > 0) {
      handleSelectFile(fileList[0], true);
    }
  };

  // If useCache is true and the next file is cached, use it
  const handleSelectFile = async (file: string, autoPlay = false, useCache = false) => {
    if (!repoInfo || !branchUsed) return;
    setSelectedFile(file);
    setFileContent(null);
    setFileError(null);
    setFileLoading(true);
    setIsPlaying(autoPlay);
    if (useCache && nextFileCache && nextFileCache.path === file) {
      setFileContent(nextFileCache.content);
      setFileLoading(false);
      return;
    }
    const content = await fetchFileContent(repoInfo.owner, repoInfo.repo, file, branchUsed, GITHUB_TOKEN);
    setFileLoading(false);
    if (content === null) {
      setFileError("Could not fetch file content.");
      setIsPlaying(false);
      return;
    }
    setFileContent(content);
  };

  // Keyboard accessibility for file list
  const handleFileKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, file: string) => {
    if (e.key === "Enter" || e.key === " ") {
      handleSelectFile(file);
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
            />
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-2 rounded mt-2 hover:bg-blue-700 disabled:opacity-50"
              onClick={handleFetchFiles}
              disabled={loading || !repoInput.trim()}
            >
              {loading ? "Loading..." : "Go!"}
            </button>
            {error && <div className="text-red-400 mt-2">{error}</div>}
          </div>
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2 text-white">Text Files</h2>
            {files ? (
              <FileTree
                nodes={buildFileTree(files)}
                selectedFile={selectedFile}
                onSelect={file => handleSelectFile(file)}
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
            dragging.current = true;
            startX.current = e.clientX;
            startWidth.current = leftWidth;
          }}
        />
        {/* Right pane: 5/6 width */}
        <div className="flex-1 border-l border-zinc-700 bg-zinc-900 p-4 flex flex-col h-screen min-h-0 overflow-x-hidden">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-sm text-gray-300 flex-1">
              {selectedFile ? selectedFile : <span className="italic text-gray-500">No file selected</span>}
            </span>
            <button
              type="button"
              className={`px-3 py-1 rounded ${isPlaying ? "bg-red-500" : "bg-green-600"} text-white`}
              onClick={() => setIsPlaying(p => !p)}
              disabled={!selectedFile || fileLoading || !!fileError}
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {fileLoading && selectedFile && <div className="text-gray-300">Loading file...</div>}
            {fileError && selectedFile && <div className="text-red-400">{fileError}</div>}
            {fileContent && selectedFile && (
              <Highlight
                code={fileContent}
                language={getLanguageFromFilename(selectedFile) || "text"}
                theme={themes.shadesOfPurple}
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
                    {tokens.map((line, i) => (
                      <div
                        key={i}
                        {...getLineProps({ line, key: i })}
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
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token, key })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            )}
            {!selectedFile && <div className="italic text-gray-500">No file selected. Select a file to start playing.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
