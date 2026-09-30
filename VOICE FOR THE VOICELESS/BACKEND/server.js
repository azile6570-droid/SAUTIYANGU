require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");

const db = require("./database");

const app = express();
const server = http.createServer(app);

const webSocketServer =
  new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is missing from the .env file"
  );
}

app.use(
  helmet({
    crossOriginResourcePolicy: false
  })
);

app.use(
  cors({
    origin:
      process.env.FRONTEND_ORIGIN ||
      "http://localhost:8000"
  })
);

app.use(
  express.json({
    limit: "20kb"
  })
);

const onlineUsers = new Map();

function createToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "2h"
    }
  );
}

function getUserById(id) {
  return db
    .prepare(`
      SELECT
        id,
        display_name,
        email,
        language,
        interest,
        bio,
        discoverable,
        created_at
      FROM users
      WHERE id = ?
    `)
    .get(id);
}

function authenticate(req, res, next) {
  const authorization =
    req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  const token =
    authorization.substring(
      "Bearer ".length
    );

  try {
    req.user = jwt.verify(
      token,
      JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token"
    });
  }
}

function findUserOrFail(userId, res) {
  const user = getUserById(userId);

  if (!user) {
    res.status(404).json({
      success: false,
      message: "User not found"
    });

    return null;
  }

  return user;
}

function sendToUser(userId, payload) {
  const socket =
    onlineUsers.get(Number(userId));

  if (
    socket &&
    socket.readyState === WebSocket.OPEN
  ) {
    socket.send(JSON.stringify(payload));
    return true;
  }

  return false;
}

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend is running"
  });
});

app.post(
  "/api/auth/register",
  async (req, res) => {
    const {
      displayName,
      email,
      password,
      language = "en",
      interest = "",
      bio = "",
      discoverable = false
    } = req.body;

    if (
      !displayName ||
      !email ||
      !password ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Display name, email, and a password of at least 8 characters are required"
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const passwordHash =
      await bcrypt.hash(password, 12);

    try {
      const result = db
        .prepare(`
          INSERT INTO users
          (
            display_name,
            email,
            password_hash,
            language,
            interest,
            bio,
            discoverable
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          displayName.trim(),
          normalizedEmail,
          passwordHash,
          language,
          interest.trim(),
          bio.trim(),
          discoverable ? 1 : 0
        );

      const user = getUserById(
        result.lastInsertRowid
      );

      const token = createToken(user);

      res.status(201).json({
        success: true,
        token,
        user
      });
    } catch (error) {
      if (
        error.code ===
        "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists"
        });
      }

      console.error(error);

      res.status(500).json({
        success: false,
        message: "Could not create account"
      });
    }
  }
);

app.post(
  "/api/auth/login",
  async (req, res) => {
    const {
      email,
      password
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required"
      });
    }

    const user = db
      .prepare(`
        SELECT *
        FROM users
        WHERE email = ?
      `)
      .get(
        email.trim().toLowerCase()
      );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const passwordIsValid =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordIsValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const safeUser =
      getUserById(user.id);

    res.json({
      success: true,
      token: createToken(safeUser),
      user: safeUser
    });
  }
);

app.get(
  "/api/me",
  authenticate,
  (req, res) => {
    const user =
      getUserById(req.user.userId);

    res.json({
      success: true,
      user
    });
  }
);

app.get(
  "/api/users",
  authenticate,
  (req, res) => {
    const search =
      String(req.query.search || "")
        .trim();

    const language =
      String(req.query.language || "all");

    const searchPattern =
      `%${search}%`;

    let users;

    if (language === "all") {
      users = db
        .prepare(`
          SELECT
            id,
            display_name,
            language,
            interest,
            bio
          FROM users
          WHERE discoverable = 1
            AND id != ?
            AND (
              display_name LIKE ?
              OR interest LIKE ?
            )
          ORDER BY display_name
          LIMIT 50
        `)
        .all(
          req.user.userId,
          searchPattern,
          searchPattern
        );
    } else {
      users = db
        .prepare(`
          SELECT
            id,
            display_name,
            language,
            interest,
            bio
          FROM users
          WHERE discoverable = 1
            AND language = ?
            AND id != ?
            AND (
              display_name LIKE ?
              OR interest LIKE ?
            )
          ORDER BY display_name
          LIMIT 50
        `)
        .all(
          language,
          req.user.userId,
          searchPattern,
          searchPattern
        );
    }

    res.json({
      success: true,
      users
    });
  }
);

app.post(
  "/api/connections",
  authenticate,
  (req, res) => {
    const receiverId =
      Number(req.body.receiverId);

    if (!Number.isInteger(receiverId)) {
      return res.status(400).json({
        success: false,
        message:
          "A valid receiverId is required"
      });
    }

    if (
      receiverId === req.user.userId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "You cannot connect to yourself"
      });
    }

    const receiver =
      findUserOrFail(
        receiverId,
        res
      );

    if (!receiver) {
      return;
    }

    try {
      db.prepare(`
        INSERT INTO connection_requests
        (sender_id, receiver_id)
        VALUES (?, ?)
      `).run(
        req.user.userId,
        receiverId
      );

      sendToUser(receiverId, {
        type: "connection-request",
        senderId: req.user.userId
      });

      res.status(201).json({
        success: true,
        message:
          "Connection request sent"
      });
    } catch (error) {
      if (
        error.code ===
        "SQLITE_CONSTRAINT_UNIQUE"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Connection request already exists"
        });
      }

      res.status(500).json({
        success: false,
        message:
          "Could not send connection request"
      });
    }
  }
);

app.get(
  "/api/connections",
  authenticate,
  (req, res) => {
    const connections = db
      .prepare(`
        SELECT
          u.id,
          u.display_name,
          u.language,
          u.interest,
          u.bio,
          c.status
        FROM connection_requests c
        JOIN users u
          ON (
            CASE
              WHEN c.sender_id = ?
              THEN c.receiver_id
              ELSE c.sender_id
            END
          ) = u.id
        WHERE
          (
            c.sender_id = ?
            OR c.receiver_id = ?
          )
          AND c.status = 'accepted'
      `)
      .all(
        req.user.userId,
        req.user.userId,
        req.user.userId
      );

    res.json({
      success: true,
      connections
    });
  }
);

app.post(
  "/api/messages",
  authenticate,
  (req, res) => {
    const {
      receiverId,
      ciphertext,
      iv,
      salt = null
    } = req.body;

    const numericReceiverId =
      Number(receiverId);

    if (
      !Number.isInteger(
        numericReceiverId
      ) ||
      !ciphertext ||
      !iv
    ) {
      return res.status(400).json({
        success: false,
        message:
          "receiverId, ciphertext, and iv are required"
      });
    }

    const receiver =
      findUserOrFail(
        numericReceiverId,
        res
      );

    if (!receiver) {
      return;
    }

    const result = db
      .prepare(`
        INSERT INTO messages
        (
          sender_id,
          receiver_id,
          ciphertext,
          iv,
          salt
        )
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        req.user.userId,
        numericReceiverId,
        String(ciphertext),
        String(iv),
        salt ? String(salt) : null
      );

    const message = {
      id: result.lastInsertRowid,
      senderId: req.user.userId,
      receiverId: numericReceiverId,
      ciphertext,
      iv,
      salt,
      createdAt: new Date().toISOString()
    };

    sendToUser(
      numericReceiverId,
      {
        type: "new-message",
        message
      }
    );

    res.status(201).json({
      success: true,
      message
    });
  }
);

app.get(
  "/api/messages/:userId",
  authenticate,
  (req, res) => {
    const otherUserId =
      Number(req.params.userId);

    if (!Number.isInteger(otherUserId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const messages = db
      .prepare(`
        SELECT
          id,
          sender_id AS senderId,
          receiver_id AS receiverId,
          ciphertext,
          iv,
          salt,
          created_at AS createdAt
        FROM messages
        WHERE
          (
            sender_id = ?
            AND receiver_id = ?
          )
          OR
          (
            sender_id = ?
            AND receiver_id = ?
          )
        ORDER BY id ASC
        LIMIT 100
      `)
      .all(
        req.user.userId,
        otherUserId,
        otherUserId,
        req.user.userId
      );

    res.json({
      success: true,
      messages
    });
  }
);

app.post(
  "/api/calls",
  authenticate,
  (req, res) => {
    const {
      receiverId,
      callType = "voice"
    } = req.body;

    const numericReceiverId =
      Number(receiverId);

    if (
      !Number.isInteger(
        numericReceiverId
      ) ||
      !["voice", "video"].includes(
        callType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid receiverId and callType are required"
      });
    }

    const receiver =
      findUserOrFail(
        numericReceiverId,
        res
      );

    if (!receiver) {
      return;
    }

    const result = db
      .prepare(`
        INSERT INTO calls
        (
          caller_id,
          receiver_id,
          call_type
        )
        VALUES (?, ?, ?)
      `)
      .run(
        req.user.userId,
        numericReceiverId,
        callType
      );

    const call = {
      id: result.lastInsertRowid,
      callerId: req.user.userId,
      receiverId: numericReceiverId,
      callType,
      status: "requested"
    };

    sendToUser(
      numericReceiverId,
      {
        type: "incoming-call",
        call
      }
    );

    res.status(201).json({
      success: true,
      call
    });
  }
);

webSocketServer.on(
  "connection",
  (socket, request) => {
    const requestUrl = new URL(
      request.url,
      `http://${request.headers.host}`
    );

    const token =
      requestUrl.searchParams.get(
        "token"
      );

    let user;

    try {
      user = jwt.verify(
        token,
        JWT_SECRET
      );
    } catch {
      socket.close(
        1008,
        "Invalid token"
      );

      return;
    }

    const userId =
      Number(user.userId);

    onlineUsers.set(
      userId,
      socket
    );

    socket.send(
      JSON.stringify({
        type: "connected",
        message:
          "Realtime connection established"
      })
    );

    socket.on(
      "message",
      (rawMessage) => {
        let event;

        try {
          event = JSON.parse(
            rawMessage.toString()
          );
        } catch {
          return;
        }

        if (
          event.type ===
          "webrtc-signal"
        ) {
          const receiverId =
            Number(event.receiverId);

          if (
            !Number.isInteger(
              receiverId
            )
          ) {
            return;
          }

          sendToUser(
            receiverId,
            {
              type: "webrtc-signal",
              senderId: userId,
              data: event.data
            }
          );
        }
      }
    );

    socket.on(
      "close",
      () => {
        if (
          onlineUsers.get(userId) ===
          socket
        ) {
          onlineUsers.delete(userId);
        }
      }
    );
  }
);

server.listen(PORT, () => {
  console.log(
    `API running at http://localhost:${PORT}`
  );

  console.log(
    `WebSocket running at ws://localhost:${PORT}`
  );
});
