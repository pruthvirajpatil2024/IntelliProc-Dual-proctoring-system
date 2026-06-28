import express from "express";
import dotenv from "dotenv";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import connectDB from "./config/db.js";
import cookieParser from "cookie-parser";
import examRoutes from "./routes/examRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import codingRoutes from "./routes/codingRoutes.js";
import resultRoutes from "./routes/resultRoutes.js";
import CheatingLog from "./models/cheatingLogModel.js";
import { exec } from "child_process";
import fs from "fs";
import { writeFileSync } from "fs";
import path from "path";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import os from "os";

dotenv.config();
connectDB();
const app = express();
const port = process.env.PORT || 5000;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// to parse req body
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Endpoint to get the server's local IP address
app.get("/api/network-ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIp = "localhost";
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIp = iface.address;
        break;
      }
    }
    if (localIp !== "localhost") break;
  }
  res.json({ ip: localIp });
});

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  socket.on("join-session", ({ sessionId, deviceType }) => {
    console.log(`[Socket] Socket ${socket.id} joining room ${sessionId} as ${deviceType}`);
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.deviceType = deviceType;

    // Notify room that device connected
    if (deviceType === "mobile") {
      io.to(sessionId).emit("mobile-connected", { socketId: socket.id });
    } else if (deviceType === "laptop") {
      // Check if a mobile is already in the room
      const room = io.sockets.adapter.rooms.get(sessionId);
      if (room) {
        let mobileExists = false;
        for (const clientId of room) {
          const clientSocket = io.sockets.sockets.get(clientId);
          if (clientSocket && clientSocket.deviceType === "mobile" && clientSocket.id !== socket.id) {
            mobileExists = true;
            break;
          }
        }
        if (mobileExists) {
          socket.emit("mobile-connected", { info: "Mobile already connected" });
        }
      }
    }
  });

  socket.on("mobile-detection", (data) => {
    const { sessionId } = socket;
    if (sessionId) {
      console.log(`[Socket] Detection event from mobile in session ${sessionId}:`, data);
      socket.to(sessionId).emit("mobile-detection", data);
    }
  });

  socket.on("heartbeat", () => {
    socket.emit("heartbeat-ack", { time: Date.now() });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Disconnected: ${socket.id}`);
    const { sessionId, deviceType } = socket;
    if (sessionId && deviceType === "mobile") {
      console.log(`[Socket] Mobile device disconnected from session ${sessionId}`);
      io.to(sessionId).emit("mobile-disconnected", { socketId: socket.id });
    }
  });
});

app.post("/run-python", (req, res) => {
  const { code } = req.body; // Get Python code from request body
  writeFileSync("script.py", code); // Write code to script.py file

  exec("python script.py", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error is: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the Python script
    }
  });
});

app.post("/run-javascript", (req, res) => {
  const { code } = req.body; // Get JavaScript code from request body
  writeFileSync("script.js", code); // Write code to script.js file

  exec("node script.js", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the JavaScript code
    }
  });
});

app.post("/run-java", (req, res) => {
  const { code } = req.body; // Get Java code from request body
  writeFileSync("Main.java", code); // Write code to Main.java file

  exec("javac Main.java && java Main", (error, stdout, stderr) => {
    if (error) {
      res.send(`Error: ${stderr}`); // Send error message if any
    } else {
      res.send(stdout); // Send output of the Java program
    }
  });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/users", examRoutes);
app.use("/api/users", resultRoutes);
app.use("/api/coding", codingRoutes);
app.use("/api/cheatingLogs", CheatingLog);

// we we are deploying this in production
// make frontend build then
if (process.env.NODE_ENV === "production") {
  const __dirname = path.resolve();
  // we making front build folder static to serve from this app
  app.use(express.static(path.join(__dirname, "/frontend/dist")));

  // if we get an routes that are not define by us we show then index html file
  // every enpoint that is not api/users go to this index file
  app.get("*", (req, res) =>
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"))
  );
} else {
  app.get("/", (req, res) => {
    res.send("<h1>server is running </h1>");
  });
}

// Error handling middleware - must be after all routes
app.use(notFound);
app.use(errorHandler);

// Server
server.listen(port, "0.0.0.0", () => {
  console.log(`server is running on http://localhost:${port}`);
});

// Todos:
// -**POST /api/users**- Register a users
// -**POST /api/users/auth**- Authenticate a user and get token
// -**POST /api/users/logout**- logou user and clear cookie
// -**GET /api/users/profile**- Get user Profile
// -**PUT /api/users/profile**- Update user Profile
