import { useState, useEffect, useRef, useCallback } from "react";

type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[] | { [key: string]: FileNode };
};

type FileTreeProps = {
  nodes: FileNode[];
  selectedFile: string | null;
  onSelect: (file: string) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
};

function FileTree({ nodes, selectedFile, onSelect, containerRef }: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<{ [path: string]: boolean }>({});
  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const isTopLevel = !containerRef;
  const effectiveContainerRef = containerRef || localContainerRef;

  const collectFolderPaths = useCallback((nodes: FileNode[], acc: Set<string>) => {
    for (const node of nodes) {
      if (node.type === "folder") {
        acc.add(node.path);
        if (Array.isArray(node.children)) {
          collectFolderPaths(node.children, acc);
        }
      }
    }
  }, []);

  // Expand all folders by default when nodes change
  useEffect(() => {
    const allFolders = new Set<string>();
    collectFolderPaths(nodes, allFolders);
    setOpenFolders(Object.fromEntries(Array.from(allFolders).map(path => [path, true])));
  }, [nodes, collectFolderPaths]);

  // Scroll selected file into middle of view
  useEffect(() => {
    const container = effectiveContainerRef.current;
    const selectedEl = selectedRef.current;
    if (container && selectedEl) {
      const containerRect = container.getBoundingClientRect();
      const selectedRect = selectedEl.getBoundingClientRect();
      const offset = selectedRect.top - containerRect.top;
      const scroll = offset - container.clientHeight / 2 + selectedRect.height / 2;
      container.scrollBy({ top: scroll, behavior: 'smooth' });
    }
  }, [selectedFile, effectiveContainerRef]);

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div ref={isTopLevel ? effectiveContainerRef : undefined} className="overflow-y-auto max-h-full">
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
                    className="text-blue-400 font-bold bg-transparent border-none cursor-pointer mr-1"
                    onClick={() => toggleFolder(node.path)}
                    aria-label={openFolders[node.path] ? "Collapse folder" : "Expand folder"}
                  >
                    {openFolders[node.path] ? "▼" : "▶"}
                  </button>
                  <span className="text-blue-400 font-bold">{node.name}</span>
                  {openFolders[node.path] && node.children && (
                    <FileTree nodes={node.children as FileNode[]} selectedFile={selectedFile} onSelect={onSelect} containerRef={effectiveContainerRef} />
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  ref={selectedFile === node.path ? selectedRef : undefined}
                  className={`pl-6 py-1 w-full text-left truncate rounded ${selectedFile === node.path ? "bg-blue-700 text-white" : "text-gray-300 hover:bg-zinc-800"}`}
                  style={{ fontWeight: selectedFile === node.path ? 600 : 400 }}
                  onClick={() => onSelect(node.path)}
                  tabIndex={0}
                >
                  {node.name}
                </button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

export type { FileNode };
export default FileTree; 