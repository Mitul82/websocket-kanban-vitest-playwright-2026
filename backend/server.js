const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const VALID_STATUSES = ["todo", "inprogress", "done"];
const VALID_PRIORITIES = ["Low", "Medium", "High"];
const VALID_CATEGORIES = ["Bug", "Feature", "Enhancement"];

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST"],
  credentials: true
};

const io = new Server(server, { cors: corsOptions });

let tasks = [];

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function broadcastTasks() {
  io.emit("sync:tasks", tasks);
}

// Validation helpers
function validateTaskShape(payload) {
  if (!payload || typeof payload !== "object") return "Invalid payload";
  if (!payload.title || typeof payload.title !== "string") return "Missing or invalid 'title'";
  if (payload.status && !VALID_STATUSES.includes(payload.status)) return "Invalid 'status'";
  if (payload.priority && !VALID_PRIORITIES.includes(payload.priority)) return "Invalid 'priority'";
  if (payload.category && !VALID_CATEGORIES.includes(payload.category)) return "Invalid 'category'";
  if (payload.attachments && !Array.isArray(payload.attachments)) return "Invalid 'attachments'";
  return null;
}

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.emit("sync:tasks", tasks);

  socket.on("task:create", (payload, ack) => {
    try {
      const err = validateTaskShape(payload);
      if (err) {
        const msg = `task:create validation failed: ${err}`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const newTask = {
        id: generateId(),
        title: payload.title,
        description: payload.description || "",
        status: payload.status && VALID_STATUSES.includes(payload.status) ? payload.status : "todo",
        priority: payload.priority && VALID_PRIORITIES.includes(payload.priority) ? payload.priority : "Medium",
        category: payload.category && VALID_CATEGORIES.includes(payload.category) ? payload.category : "Feature",
        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      };

      tasks.push(newTask);
      broadcastTasks();

      if (typeof ack === "function") ack({ status: "ok", task: newTask });
    } catch (e) {
      const message = `task:create failed: ${e.message}`;
      console.error(message, e);
      if (typeof ack === "function") return ack({ status: "error", message });
      socket.emit("error", { message });
    }
  });

  socket.on("task:update", (payload, ack) => {
    try {
      if (!payload || !payload.id) {
        const msg = "task:update requires 'id'";
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const err = validateTaskShape(payload);
      if (err && !(err === "Missing or invalid 'title'" && payload.title === undefined)) {
        const msg = `task:update validation failed: ${err}`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const idx = tasks.findIndex((t) => t.id === payload.id);
      if (idx === -1) {
        const msg = `task with id ${payload.id} not found`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const allowed = ["title", "description", "status", "priority", "category", "attachments"];
      for (const key of allowed) {
        if (payload[key] !== undefined) tasks[idx][key] = payload[key];
      }

      broadcastTasks();
      if (typeof ack === "function") ack({ status: "ok", task: tasks[idx] });
    } catch (e) {
      const message = `task:update failed: ${e.message}`;
      console.error(message, e);
      if (typeof ack === "function") return ack({ status: "error", message });
      socket.emit("error", { message });
    }
  });

  socket.on("task:move", (payload, ack) => {
    try {
      if (!payload || !payload.id || !payload.status) {
        const msg = "task:move requires 'id' and 'status'";
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      if (!VALID_STATUSES.includes(payload.status)) {
        const msg = `Invalid status '${payload.status}'`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const idx = tasks.findIndex((t) => t.id === payload.id);
      if (idx === -1) {
        const msg = `task with id ${payload.id} not found`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      tasks[idx].status = payload.status;
      broadcastTasks();
      if (typeof ack === "function") ack({ status: "ok", task: tasks[idx] });
    } catch (e) {
      const message = `task:move failed: ${e.message}`;
      console.error(message, e);
      if (typeof ack === "function") return ack({ status: "error", message });
      socket.emit("error", { message });
    }
  });

  socket.on("task:delete", (payload, ack) => {
    try {
      if (!payload || !payload.id) {
        const msg = "task:delete requires 'id'";
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const idx = tasks.findIndex((t) => t.id === payload.id);
      if (idx === -1) {
        const msg = `task with id ${payload.id} not found`;
        if (typeof ack === "function") return ack({ status: "error", message: msg });
        return socket.emit("error", { message: msg });
      }

      const removed = tasks.splice(idx, 1)[0];
      broadcastTasks();
      if (typeof ack === "function") ack({ status: "ok", task: removed });
    } catch (e) {
      const message = `task:delete failed: ${e.message}`;
      console.error(message, e);
      if (typeof ack === "function") return ack({ status: "error", message });
      socket.emit("error", { message });
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Basic health endpoint
app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
