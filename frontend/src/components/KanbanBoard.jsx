import React, { useEffect, useState, useCallback, useRef } from "react";
import socket from "../socket";
import { DndProvider, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import Select from "react-select";
import TaskCard from "./TaskCard";
import ProgressChart from "./ProgressChart";

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

function Column({ status, children, onDrop }) {
    const [{ isOver }, dropRef] = useDrop(
        () => ({
            accept: "TASK",
            drop: (item) => onDrop(item.id, status),
            collect: (m) => ({ isOver: m.isOver() }),
        }),
        [onDrop, status]
    );

    return (
        <div
            ref={dropRef}
            data-testid={`${status}-column`}
            style={{ flex: 1, padding: 8, minHeight: 300, background: isOver ? "#f0f8ff" : "#f7f7f7", borderRadius: 6 }}
        >
            <h3 style={{ textTransform: "capitalize" }}>{status.replace(/(inprogress)/, "In Progress").replace(/todo/, "To Do")}</h3>
            {children}
        </div>
    );
}



function KanbanBoard() {
    const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(PRIORITY_OPTIONS[1]);
    const [category, setCategory] = useState(CATEGORY_OPTIONS[1]);
    const [attachments, setAttachments] = useState([]);
    const [fileError, setFileError] = useState("");
    const fileRef = useRef();
    const [isDragOver, setIsDragOver] = useState(false);

    // development log removed

    useEffect(() => {
        function onSync(newTasks) {
            const t = Array.isArray(newTasks) ? newTasks : [];
            setTasks(t);
            try {
                localStorage.setItem("kanban:tasks", JSON.stringify(t));
            } catch (e) {
                console.warn("Failed to save tasks to localStorage", e);
            }
        }

        // Initialize from localStorage first so mobile/offline users see data
        try {
            const raw = localStorage.getItem("kanban:tasks");
            if (raw) setTasks(JSON.parse(raw));
        } catch (e) {
            console.warn("Failed to read tasks from localStorage", e);
        }

        socket.on("sync:tasks", onSync);
        socket.on("error", (err) => {
            console.error("Socket error:", err);
            if (err && err.message) alert(`Server error: ${err.message}`);
        });

        return () => {
                socket.off("sync:tasks", onSync);
                socket.off("error");
            };
        }, []);

    const handleCreate = useCallback(
        (e) => {
            e.preventDefault();
            if (!title.trim()) return alert("Title is required");

            const payload = {
                title: title.trim(),
                description: description.trim(),
                priority: priority?.value,
                category: category?.value,
                attachments: attachments.map((f) => ({ name: f.name, url: f.url })),
            };
            if (socket && socket.connected) {
                socket.emit("task:create", payload, (ack) => {
                    if (ack && ack.status === "error") return alert(`Create failed: ${ack.message}`);
                    // clear form — still wait for server broadcast to update task list
                    setTitle("");
                    setDescription("");
                    setPriority(PRIORITY_OPTIONS[1]);
                    setCategory(CATEGORY_OPTIONS[1]);
                    setAttachments([]);
                    setFileError("");
                    if (fileRef.current) fileRef.current.value = null;
                });
            } else {
                // Offline / disconnected: optimistically add task to local state and persist
                const localTask = {
                    id: `local-${Date.now()}`,
                    title: payload.title,
                    description: payload.description,
                    priority: payload.priority || "Medium",
                    category: payload.category || "Feature",
                    status: "todo",
                    attachments: payload.attachments || [],
                };
                const next = [localTask, ...tasks];
                setTasks(next);
                try {
                    localStorage.setItem("kanban:tasks", JSON.stringify(next));
                } catch (e) {
                    console.warn("Failed to save local task to localStorage", e);
                }

                // clear form
                setTitle("");
                setDescription("");
                setPriority(PRIORITY_OPTIONS[1]);
                setCategory(CATEGORY_OPTIONS[1]);
                setAttachments([]);
                setFileError("");
                if (fileRef.current) fileRef.current.value = null;
            }
        },
        [title, description, priority, category, attachments, tasks]
    );

    const handleDelete = useCallback((id) => {
        if (socket && socket.connected) {
            socket.emit("task:delete", { id }, (ack) => {
                if (ack && ack.status === "error") return alert(`Delete failed: ${ack.message}`);
            });
        } else {
            const next = tasks.filter((t) => t.id !== id);
            setTasks(next);
            try {
                localStorage.setItem("kanban:tasks", JSON.stringify(next));
            } catch (e) {
                console.warn("Failed to save tasks to localStorage after delete", e);
            }
        }
    }, [tasks]);

    const handleMove = useCallback((id, status) => {
        // Optimistically update local state so moves feel instantaneous
        setTasks((prev) => {
            const next = prev.map((t) => (t.id === id ? { ...t, status } : t));
            try {
                localStorage.setItem("kanban:tasks", JSON.stringify(next));
            } catch (e) {
                console.warn("Failed to save tasks to localStorage after move", e);
            }
            return next;
        });

        if (socket && socket.connected) {
            socket.emit("task:move", { id, status }, (ack) => {
                if (ack && ack.status === "error") return alert(`Move failed: ${ack.message}`);
            });
        }
    }, []);

    const handleUpdate = useCallback((id, updates) => {
        if (socket && socket.connected) {
            socket.emit("task:update", { id, ...updates }, (ack) => {
                if (ack && ack.status === "error") return alert(`Update failed: ${ack.message}`);
            });
        } else {
            const next = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
            setTasks(next);
            try {
                localStorage.setItem("kanban:tasks", JSON.stringify(next));
            } catch (e) {
                console.warn("Failed to save tasks to localStorage after update", e);
            }
        }
    }, [tasks]);

    function handleFile(e) {
        const files = Array.from(e.target.files || []);
        const accepted = [];
        const rejected = [];
        for (const f of files) {
            if (f.type && f.type.startsWith("image/")) accepted.push(f);
            else rejected.push(f);
        }

        if (rejected.length > 0) {
            setFileError("Some files were rejected: only image files are allowed.");
        } else {
            setFileError("");
        }

        if (accepted.length === 0) return;

        // Read accepted images as data URLs so attachments are portable (not tied to object URLs)
        const readers = accepted.map((file) =>
            new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => resolve({ name: file.name, url: fr.result });
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(file);
            })
        );

        Promise.all(readers).then((results) => {
            const previews = results.filter(Boolean);
            if (previews.length > 0) setAttachments((prev) => [...prev, ...previews]);
        });
    }

    // Handle files dropped onto the create form
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length === 0) return;

        // Reuse same logic as file input: only accept images and convert to data URLs
        const accepted = [];
        const rejected = [];
        for (const f of files) {
            if (f.type && f.type.startsWith("image/")) accepted.push(f);
            else rejected.push(f);
        }
        if (rejected.length > 0) setFileError("Some files were rejected: only image files are allowed.");
        else setFileError("");

        if (accepted.length === 0) return;

        const readers = accepted.map((file) =>
            new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => resolve({ name: file.name, url: fr.result });
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(file);
            })
        );

        Promise.all(readers).then((results) => {
            const previews = results.filter(Boolean);
            if (previews.length > 0) setAttachments((prev) => [...prev, ...previews]);
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        setIsDragOver(true);
    }

    function handleDragLeave(e) {
        e.preventDefault();
        setIsDragOver(false);
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="kanban-root" style={{ display: "flex", gap: 16 }}>
                <div className="kanban-main" style={{ flex: 3 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                        <form
                            onSubmit={handleCreate}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            style={{
                                flex: 1,
                                padding: 12,
                                background: "#fff",
                                borderRadius: 8,
                                outline: isDragOver ? "3px dashed #4CAF50" : "none",
                            }}
                        >
                            <h3>Create Task</h3>
                            <div>
                                <input data-testid="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ width: "100%" }} />
                            </div>
                            <div>
                                <textarea data-testid="description-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" style={{ width: "100%" }} />
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <div style={{ flex: 1 }} data-testid="priority-select">
                                    <label>Priority</label>
                                    <Select options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
                                </div>
                                <div style={{ flex: 1 }} data-testid="category-select">
                                    <label>Category</label>
                                    <Select options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
                                </div>
                            </div>
                            <div>
                                <label>Attachments (drag and drop the image)</label>
                                <input data-testid="file-input" ref={fileRef} type="file" accept="image/*" multiple onChange={handleFile} />
                                <div className="create-attachments" style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    {attachments.map((a, i) => (
                                        <img key={i} data-testid="create-preview-img" className="attachment-thumb" src={a.url} alt={a.name} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                                    ))}
                                </div>
                                {fileError && <div data-testid="file-error" style={{ color: "#c00", marginTop: 6 }}>{fileError}</div>}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <button data-testid="create-button" type="submit">Create</button>
                            </div>
                        </form>

                        <div style={{ width: 360 }}>
                            <ProgressChart tasks={tasks} />
                        </div>
                    </div>

                    <div className="columns-row" style={{ display: "flex", gap: 12, marginTop: 16 }}>
                        <Column status="todo" onDrop={handleMove}>
                                {tasks.filter((t) => t.status === "todo").map((t) => (
                                <TaskCard key={t.id} task={t} onDelete={handleDelete} onMove={handleMove} onUpdate={handleUpdate} />
                            ))}
                        </Column>

                        <Column status="inprogress" onDrop={handleMove}>
                            {tasks.filter((t) => t.status === "inprogress").map((t) => (
                                <TaskCard key={t.id} task={t} onDelete={handleDelete} onMove={handleMove} onUpdate={handleUpdate} />
                            ))}
                        </Column>

                        <Column status="done" onDrop={handleMove}>
                            {tasks.filter((t) => t.status === "done").map((t) => (
                                <TaskCard key={t.id} task={t} onDelete={handleDelete} onMove={handleMove} onUpdate={handleUpdate} />
                            ))}
                        </Column>
                    </div>
                </div>
            </div>
        </DndProvider>
    );
}

export default KanbanBoard;
