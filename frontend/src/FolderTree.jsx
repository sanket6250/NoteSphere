import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Folder, FolderOpen, MoreHorizontal, Plus } from 'lucide-react';
import { PortalMenu, useManagedMenu } from './OverlaySystem';

function FolderRow({
  folder,
  childrenByParent,
  selectedFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  depth = 0,
}) {
  const [expanded, setExpanded] = useState(true);
  const menu = useManagedMenu();
  const menuAnchorRef = useRef(null);
  const children = childrenByParent.get(folder.id) || [];

  return (
    <div className="folder-tree-node">
      <div className={`folder-row${selectedFolderId === folder.id ? ' folder-row-active' : ''}`} style={{ '--folder-depth': depth }}>
        <button
          type="button"
          className="folder-expand"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${folder.name}`}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronRight className={expanded ? 'folder-chevron is-expanded' : 'folder-chevron'} size={13} />
        </button>
        <button type="button" className="folder-select" onClick={() => onSelect(folder.id)}>
          {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
          <span>{folder.name}</span>
          <small>{folder.noteCount || 0}</small>
        </button>
        <div className="folder-actions" {...menu.menuProps}>
          <button type="button" aria-label={`Add subfolder under ${folder.name}`} title="Add subfolder" onClick={() => onCreate(folder)}>
            <Plus size={13} />
          </button>
          <button
            type="button"
            ref={menuAnchorRef}
            aria-label={`Actions for ${folder.name}`}
            title="Folder actions"
            aria-expanded={menu.open}
            onClick={menu.toggle}
          >
            <MoreHorizontal size={15} />
          </button>
          <PortalMenu
            anchorRef={menuAnchorRef}
            align="end"
            className="folder-menu"
            label={`Actions for ${folder.name}`}
            menuProps={menu.portalProps}
            open={menu.open}
            role="menu"
          >
            <button type="button" role="menuitem" onClick={() => { menu.close(); onRename(folder); }}>Rename</button>
            <button type="button" role="menuitem" onClick={() => { menu.close(); onDelete(folder); }}>Delete folder…</button>
          </PortalMenu>
        </div>
      </div>
      {expanded && children.length > 0 && (
        <div className="folder-children">
          {children.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              childrenByParent={childrenByParent}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map();
    folders.forEach((folder) => {
      const key = folder.parentFolderId || null;
      const children = map.get(key) || [];
      children.push(folder);
      map.set(key, children);
    });
    return map;
  }, [folders]);
  const roots = childrenByParent.get(null) || [];

  return (
    <div className="folder-tree">
      {roots.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          childrenByParent={childrenByParent}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
