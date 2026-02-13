import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDrag } from "react-dnd";
import Select from "react-select";
import socket from "../socket";

const PRIORITY_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const CATEGORY_OPTIONS = [
  { value: "Bug", label: "Bug" },
  { value: "Feature", label: "Feature" },
  { value: "Enhancement", label: "Enhancement" },
];

function TaskCard({ task, onDelete, onMove, onUpdate }) {
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: "TASK",
    item: { id: task.id },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title || "");
  const [editDescription, setEditDescription] = useState(task.description || "");
  const [editAttachments, setEditAttachments] = useState(Array.isArray(task.attachments) ? task.attachments.slice() : []);

  useEffect(() => {
    setEditTitle(task.title || "");
    setEditDescription(task.description || "");
    setEditAttachments(Array.isArray(task.attachments) ? task.attachments.slice() : []);
  }, [task.title, task.description, task.attachments]);

  function startEdit() {
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditTitle(task.title || "");
    setEditDescription(task.description || "");
  }

  function saveEdit() {
    const updates = { title: (editTitle || "").trim(), description: (editDescription || "").trim(), attachments: editAttachments };
    if (!updates.title) return alert("Title is required");
    if (typeof onUpdate === "function") {
      onUpdate(task.id, updates);
    } else {
      socket.emit("task:update", { id: task.id, ...updates }, (ack) => {
        if (ack && ack.status === "error") return alert(`Update failed: ${ack.message}`);
      });
    }
    setEditing(false);
  }

  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const lightboxRef = useRef(null);
  const portalRef = useRef(null);

  useEffect(() => {
    if (lightboxIndex >= 0 && lightboxRef.current) {
      try {
        lightboxRef.current.focus();
      } catch {
        // ignore focus errors
      }
    }
  }, [lightboxIndex]);

  // Create a portal root for the lightbox to escape card stacking contexts
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.className = "taskcard-lightbox-portal";
    portalRef.current = el;
    document.body.appendChild(el);
    return () => {
      try {
        if (portalRef.current) document.body.removeChild(portalRef.current);
      } catch {
        // ignore
      }
    };
  }, []);

  function onPriorityChange(option) {
    const updates = { priority: option?.value };
    if (typeof onUpdate === "function") return onUpdate(task.id, updates);
    socket.emit("task:update", { id: task.id, ...updates }, (ack) => {
      if (ack && ack.status === "error") alert(`Update failed: ${ack.message}`);
    });
  }

  // Handle file selection and convert to data URLs so the in-memory backend can store attachments
  async function handleFileInput(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const readers = files.map((file) => {
      return new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve({ name: file.name, url: fr.result });
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(file);
      });
    });

    const results = await Promise.all(readers);
    const added = results.filter(Boolean);
    if (added.length > 0) setEditAttachments((s) => s.concat(added));
    // clear the input value to allow re-uploading same file if needed
    e.target.value = "";
  }

  // Allow dropping files into the edit area
  async function handleEditDropFiles(files) {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    const readers = list.map((file) =>
      new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => resolve({ name: file.name, url: fr.result });
        fr.onerror = () => resolve(null);
        fr.readAsDataURL(file);
      })
    );
    const results = await Promise.all(readers);
    const added = results.filter(Boolean);
    if (added.length > 0) setEditAttachments((s) => s.concat(added));
  }

  function onEditDragOver(e) {
    e.preventDefault();
  }

  function onEditDrop(e) {
    e.preventDefault();
    setEditDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleEditDropFiles(files);
    }
  }

  const [editDragOver, setEditDragOver] = useState(false);

  function onEditDragEnter(e) {
    e.preventDefault();
    setEditDragOver(true);
  }

  function onEditDragLeave(e) {
    e.preventDefault();
    setEditDragOver(false);
  }

  function removeEditAttachment(index) {
    setEditAttachments((s) => s.filter((_, i) => i !== index));
  }

  function onCategoryChange(option) {
    const updates = { category: option?.value };
    if (typeof onUpdate === "function") return onUpdate(task.id, updates);
    socket.emit("task:update", { id: task.id, ...updates }, (ack) => {
      if (ack && ack.status === "error") alert(`Update failed: ${ack.message}`);
    });
  }

  function changeStatus(status) {
    if (typeof onMove === "function") return onMove(task.id, status);
    socket.emit("task:move", { id: task.id, status }, (ack) => {
      if (ack && ack.status === "error") alert(`Move failed: ${ack.message}`);
    });
  }

  return (
    <div
      ref={dragRef}
      style={{
        opacity: isDragging ? 0.5 : 1,
        border: "1px solid #ccc",
        padding: 8,
        marginBottom: 8,
        background: "#fff",
        borderRadius: 4,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      data-testid={`task-${task.id}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!editing ? (
            <>
              <strong>{task.title}</strong>
              {String(task.id).startsWith("local-") && (
                <span
                  aria-hidden="true"
                  style={{ background: "#ff9800", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}
                >
                  Unsynced
                </span>
              )}
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input aria-label="Edit title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ fontWeight: 700 }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {task.status !== "done" && !editing && (
            <button onClick={startEdit} aria-label="Edit task">✎</button>
          )}
          {editing && (
            <>
              <button onClick={saveEdit} aria-label="Save task edits">Save</button>
              <button onClick={cancelEdit} aria-label="Cancel edit">Cancel</button>
            </>
          )}
          <button onClick={() => onDelete(task.id)} aria-label="Delete task">✕</button>
        </div>
      </div>

      {!editing && <div style={{ fontSize: 12, color: "#555" }}>{task.description}</div>}
      {editing && (
        <div style={{ marginTop: 8 }}>
          <textarea aria-label="Edit description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ width: "100%" }} />
        </div>
      )}

      {editing && (
        <div style={{ marginTop: 8 }}>
          <label
            className={`task-edit-droparea ${editDragOver ? "drag-over" : ""}`}
            onDrop={onEditDrop}
            onDragOver={onEditDragOver}
            onDragEnter={onEditDragEnter}
            onDragLeave={onEditDragLeave}
            style={{ display: "block", marginBottom: 6, padding: 6, borderRadius: 6 }}
          >
            Attachments (drag and drop the image)
            <input aria-label="Add attachments" type="file" accept="image/*" multiple onChange={handleFileInput} style={{ display: "block", marginTop: 6 }} />
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>You can also drag & drop images here</div>
          </label>

          {editAttachments && editAttachments.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {editAttachments.map((a, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img className="attachment-thumb" src={a.url} alt={a.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6 }} />
                  <button
                    onClick={() => removeEditAttachment(i)}
                    aria-label={`Remove attachment ${a.name}`}
                    style={{ position: "absolute", top: -6, right: -6, background: "#fff", borderRadius: 12, border: "1px solid #ccc", padding: 4, cursor: "pointer" }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ minWidth: 120 }} data-testid={`priority-select-${task.id}`}>
          <Select
            options={PRIORITY_OPTIONS}
            value={PRIORITY_OPTIONS.find((o) => o.value === task.priority) || PRIORITY_OPTIONS[1]}
            onChange={onPriorityChange}
          />
        </div>

        <div style={{ minWidth: 140 }} data-testid={`category-select-${task.id}`}>
          <Select
            options={CATEGORY_OPTIONS}
            value={CATEGORY_OPTIONS.find((o) => o.value === task.category) || CATEGORY_OPTIONS[1]}
            onChange={onCategoryChange}
          />
        </div>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {task.status !== "done" && (
          <>
            <button onClick={() => changeStatus("inprogress")} title="Move to In Progress" aria-label="Move to In Progress">▶</button>
            <button onClick={() => changeStatus("done")} title="Mark Done" aria-label="Mark done">✓</button>
          </>
        )}
      </div>

      {task.attachments && task.attachments.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          {task.attachments.map((a, i) => (
            <img
              key={i}
              className="attachment-thumb"
              src={a.url}
              alt={a.name}
              style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, cursor: "pointer" }}
              onClick={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      )}

      {portalRef.current && lightboxIndex >= 0 && task.attachments && task.attachments[lightboxIndex] &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Preview image for ${task.title}`}
            ref={lightboxRef}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Escape") setLightboxIndex(-1);
            }}
            onClick={() => setLightboxIndex(-1)}
            style={{
              position: "fixed",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.6)",
              zIndex: 99999,
            }}
          >
            <img
              className="attachment-lightbox"
              src={task.attachments[lightboxIndex].url}
              alt={task.attachments[lightboxIndex].name}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "90%", maxHeight: "90%", borderRadius: 8 }}
            />
          </div>,
          portalRef.current
        )}
    </div>
  );
}

export default TaskCard;

