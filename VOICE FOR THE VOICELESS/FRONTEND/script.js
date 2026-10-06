const phraseText = {
  en: {
    help: "I need help",
    hungry: "I am hungry",
    thirsty: "I am thirsty",
    pain: "I am in pain",
    family: "Please call my family",
    thanks: "Thank you"
  },

  sw: {
    help: "Nahitaji msaada",
    hungry: "Nina njaa",
    thirsty: "Nina kiu",
    pain: "Nina maumivu",
    family: "Tafadhali pigia familia yangu",
    thanks: "Asante"
  }
};

const API_BASE_URL = "http://localhost:3000/api";

let language = "en";
let selectedMessage = "";
let selectedPerson = null;
let history = [];
let messages = [];
let authMode = "login";

const authState = {
  token: localStorage.getItem("sautiYanguToken") || "",
  user: JSON.parse(localStorage.getItem("sautiYanguUser") || "null")
};

const languageButtons = document.querySelectorAll(".lang-btn");
const quickButtons = document.querySelectorAll(".quick-btn");
const customInput = document.getElementById("customInput");
const previewText = document.getElementById("previewText");
const speedRange = document.getElementById("speedRange");
const speedValue = document.getElementById("speedValue");
const statusText = document.getElementById("statusText");
const authStatus = document.getElementById("authStatus");

function setAuthStatus(message, isError = false) {
  if (!authStatus) {
    return;
  }

  authStatus.textContent = message;
  authStatus.style.color = isError ? "#d63d55" : "#2d7d64";
}

function saveAuthSession(token, user) {
  authState.token = token;
  authState.user = user;
  localStorage.setItem("sautiYanguToken", token);
  localStorage.setItem("sautiYanguUser", JSON.stringify(user));
}

function clearAuthSession() {
  authState.token = "";
  authState.user = null;
  localStorage.removeItem("sautiYanguToken");
  localStorage.removeItem("sautiYanguUser");
}

async function apiFetch(endpoint, options = {}) {
  const headers = {
    ...(options.headers || {})
  };

  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

function updateLanguageButtons() {
  languageButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.lang === language
    );
  });
}

function updatePhraseLabels() {
  quickButtons.forEach((button) => {
    const key = button.dataset.message;
    const label = button.querySelector("span");

    if (label) {
      label.textContent = phraseText[language][key];
    }
  });
}

function updatePreview() {
  previewText.textContent =
    selectedMessage ||
    (
      language === "sw"
        ? "Chagua ujumbe kuanza."
        : "Choose a message to begin."
    );
}

function selectMessage(message, button = null) {
  selectedMessage = message;
  customInput.value = message;

  quickButtons.forEach((item) => {
    item.classList.remove("selected");
  });

  if (button) {
    button.classList.add("selected");
  }

  updatePreview();
}

function speakMessage() {
  const message = customInput.value.trim() || selectedMessage;

  if (!message) {
    statusText.textContent =
      language === "sw"
        ? "Chagua au andika ujumbe kwanza."
        : "Choose or type a message first.";

    return;
  }

  selectedMessage = message;
  updatePreview();

  if (!("speechSynthesis" in window)) {
    statusText.textContent = "Speech is not supported in this browser.";
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);

  utterance.lang = language === "sw" ? "sw-KE" : "en-US";
  utterance.rate = Number(speedRange.value);
  utterance.pitch = 1;
  utterance.volume = 1;

  utterance.onstart = () => {
    statusText.textContent =
      language === "sw"
        ? "Ujumbe unasemwa..."
        : "Speaking message...";
  };

  utterance.onend = () => {
    statusText.textContent =
      language === "sw"
        ? "Tayari"
        : "Ready";
  };

  utterance.onerror = () => {
    statusText.textContent = "Speech could not be played.";
  };

  window.speechSynthesis.speak(utterance);

  history.unshift({
    text: message,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    })
  });

  history = history.slice(0, 6);
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById("historyList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (history.length === 0) {
    list.innerHTML = `
      <li class="empty-history">
        No messages yet.
      </li>
    `;

    return;
  }

  history.forEach((item) => {
    const row = document.createElement("li");
    row.textContent = `${item.text} · ${item.time}`;
    list.appendChild(row);
  });
}

function renderPeople() {
  const list = document.getElementById("peopleList");

  if (!list) {
    return;
  }

  if (!authState.user || !authState.token) {
    list.innerHTML = `
      <p class="empty-messages">
        Log in to view community members.
      </p>
    `;
    return;
  }

  const search =
    document.getElementById("peopleSearch").value.trim().toLowerCase();

  const selectedLanguage =
    document.getElementById("connectionLanguage").value;

  const query = new URLSearchParams({
    search,
    language: selectedLanguage
  });

  apiFetch(`/users?${query.toString()}`)
    .then((data) => {
      const users = data.users || [];
      list.innerHTML = "";

      if (users.length === 0) {
        list.innerHTML = `
          <p class="empty-messages">
            No connections found.
          </p>
        `;
        return;
      }

      users.forEach((person) => {
        const card = document.createElement("article");
        const avatar = (person.display_name || "U").charAt(0).toUpperCase();
        const personInfo = document.createElement("div");
        const avatarElement = document.createElement("div");
        const details = document.createElement("div");
        const name = document.createElement("p");
        const interest = document.createElement("p");
        const actions = document.createElement("div");
        const connectButton = document.createElement("button");
        const messageButton = document.createElement("button");

        card.className = "person-card";
        personInfo.className = "person-info";
        avatarElement.className = "person-avatar";
        avatarElement.textContent = avatar;
        details.append(name, interest);
        name.className = "person-name";
        name.textContent = person.display_name;
        interest.className = "person-meta";
        interest.textContent = person.interest || "New connection";
        actions.className = "person-actions";
        connectButton.dataset.connect = person.id;
        connectButton.textContent = "Connect";
        messageButton.dataset.message = person.id;
        messageButton.textContent = "Message";
        personInfo.append(avatarElement, details);
        actions.append(connectButton, messageButton);
        card.append(personInfo, actions);

        list.appendChild(card);
      });

      document.querySelectorAll("[data-connect]").forEach((button) => {
        button.addEventListener("click", async () => {
          const personId = Number(button.dataset.connect);
          const person = users.find((user) => user.id === personId);

          try {
            await apiFetch("/connections", {
              method: "POST",
              body: JSON.stringify({ receiverId: personId })
            });

            alert(`Connection request sent to ${person.display_name}.`);
          } catch (error) {
            alert(error.message || "Could not send connection request.");
          }
        });
      });

      document.querySelectorAll("[data-message]").forEach((button) => {
        button.addEventListener("click", () => {
          const personId = Number(button.dataset.message);
          const person = users.find((user) => user.id === personId);
          openConversation(person);
        });
      });
    })
    .catch((error) => {
      list.innerHTML = `
        <p class="empty-messages">
          ${error.message}
        </p>
      `;
    });
}

function openConversation(person) {
  if (!person) {
    return;
  }

  selectedPerson = person;
  document.getElementById("conversationTitle").textContent =
    `Conversation with ${person.display_name || person.name}`;

  loadConversation(person.id);

  document.getElementById("messages").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderMessages() {
  const list = document.getElementById("messageList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!selectedPerson) {
    list.innerHTML = `
      <p class="empty-messages">
        Choose someone to start a conversation.
      </p>
    `;

    return;
  }

  const conversation = messages.filter(
    (message) => message.personId === selectedPerson.id
  );

  if (conversation.length === 0) {
    list.innerHTML = `
      <p class="empty-messages">
        No messages yet. Start the conversation.
      </p>
    `;
    return;
  }

  conversation.forEach((message) => {
    const item = document.createElement("div");
    const text = document.createElement("span");
    const time = document.createElement("small");

    item.className = message.mine ? "chat-message mine" : "chat-message";
    text.textContent = message.text;
    time.textContent = message.time;
    item.append(text, time);
    list.appendChild(item);
  });

  list.scrollTop = list.scrollHeight;
}

async function loadConversation(personId) {
  if (!authState.token || !authState.user) {
    return;
  }

  try {
    const response = await apiFetch(`/messages/${personId}`);
    const serverMessages = response.messages || [];

    messages = serverMessages.map((message) => ({
      personId:
        message.senderId === authState.user.id
          ? message.receiverId
          : message.senderId,
      text: message.ciphertext,
      mine: message.senderId === authState.user.id,
      time: new Date(message.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
      })
    }));

    renderMessages();
  } catch (error) {
    const list = document.getElementById("messageList");
    list.textContent = error.message || "Could not load messages.";
  }
}

async function encryptDemoMessage(message) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoder.encode(message)
  );

  return {
    iv: Array.from(iv),
    ciphertext: Array.from(new Uint8Array(encrypted))
  };
}

function updateAuthFormState() {
  const displayNameField = document.getElementById("authDisplayName");
  const authSubmit = document.getElementById("authSubmit");
  const authTabs = document.querySelectorAll("[data-auth-mode]");

  authTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === authMode);
  });

  if (displayNameField) {
    displayNameField.style.display = authMode === "register" ? "block" : "none";
    displayNameField.required = authMode === "register";
  }

  if (authSubmit) {
    authSubmit.textContent = authMode === "register" ? "Register" : "Log in";
  }
}

function updateLoggedInState() {
  const loggedInState = document.getElementById("loggedInState");
  const authForm = document.getElementById("authForm");
  const loggedInMessage = document.getElementById("loggedInMessage");

  if (authState.user && authState.token) {
    if (loggedInState) loggedInState.style.display = "block";
    if (authForm) authForm.style.display = "none";
    if (loggedInMessage) {
      loggedInMessage.textContent = `Signed in as ${authState.user.display_name}`;
    }

    const profileName = document.getElementById("profileName");
    if (profileName && !profileName.value) {
      profileName.value = authState.user.display_name || "";
    }
  } else {
    if (loggedInState) loggedInState.style.display = "none";
    if (authForm) authForm.style.display = "grid";
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const displayName = document.getElementById("authDisplayName").value.trim();

  if (!email || !password) {
    setAuthStatus("Email and password are required.", true);
    return;
  }

  try {
    const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
    const payload = authMode === "register"
      ? {
          displayName,
          email,
          password,
          language
        }
      : { email, password };

    const result = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    saveAuthSession(result.token, result.user);
    setAuthStatus(
      authMode === "register"
        ? "Account created successfully."
        : "Logged in successfully."
    );

    updateLoggedInState();
    renderPeople();
    if (selectedPerson) {
      loadConversation(selectedPerson.id);
    }
  } catch (error) {
    setAuthStatus(error.message || "Authentication failed.", true);
  }
}

function handleLogout() {
  clearAuthSession();
  selectedPerson = null;
  messages = [];
  renderMessages();
  updateLoggedInState();
  renderPeople();
  setAuthStatus("You have been logged out.");
}

document
  .querySelectorAll(".lang-btn")
  .forEach((button) => {
    if (button.dataset.lang) {
      button.addEventListener("click", () => {
        language = button.dataset.lang;
        selectedMessage = "";
        customInput.value = "";

        updateLanguageButtons();
        updatePhraseLabels();
        updatePreview();
      });
    }
  });

document
  .getElementById("languageToggle")
  .addEventListener("click", () => {
    language = language === "en" ? "sw" : "en";
    selectedMessage = "";
    customInput.value = "";

    updateLanguageButtons();
    updatePhraseLabels();
    updatePreview();
  });

quickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.message;
    selectMessage(phraseText[language][key], button);
  });
});

document
  .querySelectorAll("[data-demo]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.demo;
      document.getElementById("demoMessage").textContent = phraseText[language][key];
    });
  });

document
  .getElementById("demoSpeak")
  .addEventListener("click", () => {
    const message = document.getElementById("demoMessage").textContent;

    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = language === "sw" ? "sw-KE" : "en-US";
      window.speechSynthesis.speak(utterance);
    }
  });

customInput.addEventListener("input", () => {
  selectedMessage = customInput.value.trim();
  updatePreview();
});

document.getElementById("speakBtn").addEventListener("click", speakMessage);

document
  .getElementById("clearBtn")
  .addEventListener("click", () => {
    selectedMessage = "";
    customInput.value = "";

    quickButtons.forEach((button) => {
      button.classList.remove("selected");
    });

    updatePreview();
    statusText.textContent = language === "sw" ? "Tayari" : "Ready";
  });

document
  .getElementById("speedRange")
  .addEventListener("input", () => {
    speedValue.textContent = `${Number(speedRange.value).toFixed(2)}x`;
  });

document
  .getElementById("peopleSearch")
  .addEventListener("input", renderPeople);

document
  .getElementById("connectionLanguage")
  .addEventListener("change", renderPeople);

document
  .getElementById("saveProfile")
  .addEventListener("click", () => {
    const name = document.getElementById("profileName").value.trim();

    if (!name) {
      document.getElementById("profileStatus").textContent = "Enter a display name first.";
      return;
    }

    localStorage.setItem(
      "sautiYanguProfile",
      JSON.stringify({
        name,
        interest: document.getElementById("profileInterest").value,
        bio: document.getElementById("profileBio").value,
        discoverable: document.getElementById("profileDiscoverable").checked
      })
    );

    document.getElementById("profileStatus").textContent = "Profile saved on this device.";
  });

document
  .getElementById("sendMessage")
  .addEventListener("click", async () => {
    const input = document.getElementById("messageInput");
    const text = input.value.trim();

    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    if (!text) {
      return;
    }

    try {
      const result = await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedPerson.id,
          ciphertext: text,
          iv: "demo-plaintext"
        })
      });

      messages.push({
        personId: selectedPerson.id,
        text,
        mine: true,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        })
      });

      input.value = "";
      renderMessages();
      if (result && result.message) {
        setAuthStatus("Message sent.");
      }
    } catch (error) {
      alert(error.message || "Could not send message.");
    }
  });

document
  .getElementById("startCall")
  .addEventListener("click", async () => {
    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    try {
      await apiFetch("/calls", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedPerson.id,
          callType: "voice"
        })
      });

      alert(`Voice-call request sent to ${selectedPerson.display_name || selectedPerson.name}.`);
    } catch (error) {
      alert(error.message || "Could not start the call.");
    }
  });

document
  .getElementById("startVideoCall")
  .addEventListener("click", async () => {
    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    if (!navigator.mediaDevices) {
      alert("Camera and microphone are not available here.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });

      stream.getTracks().forEach((track) => track.stop());

      await apiFetch("/calls", {
        method: "POST",
        body: JSON.stringify({
          receiverId: selectedPerson.id,
          callType: "video"
        })
      });

      alert(`Video-call request sent to ${selectedPerson.display_name || selectedPerson.name}.`);
    } catch (error) {
      alert(error.message || "Camera or microphone permission was not granted.");
    }
  });

document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    authMode = button.dataset.authMode;
    updateAuthFormState();
  });
});

document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);
document.getElementById("logoutBtn").addEventListener("click", handleLogout);

if (authState.user && authState.token) {
  updateLoggedInState();
  renderPeople();
}

renderPeople();
renderMessages();
updateLanguageButtons();
updatePhraseLabels();
updatePreview();
updateAuthFormState();
updateLoggedInState();
