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

let language = "en";
let selectedMessage = "";
let selectedPerson = null;
let history = [];
let messages = [];

const languageButtons = document.querySelectorAll(".lang-btn");
const quickButtons = document.querySelectorAll(".quick-btn");
const customInput = document.getElementById("customInput");
const previewText = document.getElementById("previewText");
const speedRange = document.getElementById("speedRange");
const speedValue = document.getElementById("speedValue");
const statusText = document.getElementById("statusText");

const demoPeople = [
  {
    id: "amina",
    name: "Amina",
    interest: "Art and school",
    language: "sw",
    avatar: "A"
  },
  {
    id: "brian",
    name: "Brian",
    interest: "Music and games",
    language: "en",
    avatar: "B"
  },
  {
    id: "zawadi",
    name: "Zawadi",
    interest: "Reading and friends",
    language: "sw",
    avatar: "Z"
  }
];

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
  const message =
    customInput.value.trim() || selectedMessage;

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
    statusText.textContent =
      "Speech is not supported in this browser.";

    return;
  }

  window.speechSynthesis.cancel();

  const utterance =
    new SpeechSynthesisUtterance(message);

  utterance.lang =
    language === "sw"
      ? "sw-KE"
      : "en-US";

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
    statusText.textContent =
      "Speech could not be played.";
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

  const search =
    document.getElementById("peopleSearch")
      .value
      .toLowerCase()
      .trim();

  const selectedLanguage =
    document.getElementById("connectionLanguage")
      .value;

  const people = demoPeople.filter((person) => {
    const matchesSearch =
      person.name.toLowerCase().includes(search) ||
      person.interest.toLowerCase().includes(search);

    const matchesLanguage =
      selectedLanguage === "all" ||
      person.language === selectedLanguage;

    return matchesSearch && matchesLanguage;
  });

  list.innerHTML = "";

  if (people.length === 0) {
    list.innerHTML = `
      <p class="empty-messages">
        No connections found.
      </p>
    `;

    return;
  }

  people.forEach((person) => {
    const card = document.createElement("article");

    card.className = "person-card";

    card.innerHTML = `
      <div class="person-info">
        <div class="person-avatar">
          ${person.avatar}
        </div>

        <div>
          <p class="person-name">
            ${person.name}
          </p>

          <p class="person-meta">
            ${person.interest}
          </p>
        </div>
      </div>

      <div class="person-actions">
        <button data-connect="${person.id}">
          Connect
        </button>

        <button data-message="${person.id}">
          Message
        </button>
      </div>
    `;

    list.appendChild(card);
  });

  document
    .querySelectorAll("[data-connect]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const person = demoPeople.find(
          (item) =>
            item.id === button.dataset.connect
        );

        alert(
          `Connection request sent to ${person.name}.`
        );
      });
    });

  document
    .querySelectorAll("[data-message]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const person = demoPeople.find(
          (item) =>
            item.id === button.dataset.message
        );

        openConversation(person);
      });
    });
}

function openConversation(person) {
  selectedPerson = person;

  document.getElementById(
    "conversationTitle"
  ).textContent =
    `Conversation with ${person.name}`;

  renderMessages();

  document
    .getElementById("messages")
    .scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function renderMessages() {
  const list = document.getElementById("messageList");

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
    (message) =>
      message.personId === selectedPerson.id
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

    item.className =
      message.mine
        ? "chat-message mine"
        : "chat-message";

    item.innerHTML = `
      ${message.text}
      <small>${message.time}</small>
    `;

    list.appendChild(item);
  });

  list.scrollTop = list.scrollHeight;
}

async function encryptDemoMessage(message) {
  const encoder = new TextEncoder();

  const key =
    await crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256
      },
      true,
      ["encrypt", "decrypt"]
    );

  const iv = crypto.getRandomValues(
    new Uint8Array(12)
  );

  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv
      },
      key,
      encoder.encode(message)
    );

  return {
    iv: Array.from(iv),
    ciphertext: Array.from(
      new Uint8Array(encrypted)
    )
  };
}

document
  .querySelectorAll(".lang-btn")
  .forEach((button) => {
    button.addEventListener("click", () => {
      language = button.dataset.lang;
      selectedMessage = "";
      customInput.value = "";

      updateLanguageButtons();
      updatePhraseLabels();
      updatePreview();
    });
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

    selectMessage(
      phraseText[language][key],
      button
    );
  });
});

document
  .querySelectorAll("[data-demo]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.demo;

      document.getElementById(
        "demoMessage"
      ).textContent =
        phraseText[language][key];
    });
  });

document
  .getElementById("demoSpeak")
  .addEventListener("click", () => {
    const message =
      document.getElementById(
        "demoMessage"
      ).textContent;

    if ("speechSynthesis" in window) {
      const utterance =
        new SpeechSynthesisUtterance(message);

      utterance.lang =
        language === "sw"
          ? "sw-KE"
          : "en-US";

      window.speechSynthesis.speak(utterance);
    }
  });

customInput.addEventListener("input", () => {
  selectedMessage = customInput.value.trim();
  updatePreview();
});

document
  .getElementById("speakBtn")
  .addEventListener("click", speakMessage);

document
  .getElementById("clearBtn")
  .addEventListener("click", () => {
    selectedMessage = "";
    customInput.value = "";

    quickButtons.forEach((button) => {
      button.classList.remove("selected");
    });

    updatePreview();

    statusText.textContent =
      language === "sw" ? "Tayari" : "Ready";
  });

document
  .getElementById("speedRange")
  .addEventListener("input", () => {
    speedValue.textContent =
      `${Number(speedRange.value).toFixed(2)}x`;
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
    const name =
      document.getElementById("profileName")
        .value
        .trim();

    if (!name) {
      document.getElementById(
        "profileStatus"
      ).textContent =
        "Enter a display name first.";

      return;
    }

    localStorage.setItem(
      "sautiYanguProfile",
      JSON.stringify({
        name,
        interest:
          document.getElementById(
            "profileInterest"
          ).value,
        bio:
          document.getElementById(
            "profileBio"
          ).value,
        discoverable:
          document.getElementById(
            "profileDiscoverable"
          ).checked
      })
    );

    document.getElementById(
      "profileStatus"
    ).textContent =
      "Profile saved on this device.";
  });

document
  .getElementById("sendMessage")
  .addEventListener("click", async () => {
    const input =
      document.getElementById("messageInput");

    const text = input.value.trim();

    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    if (!text) {
      return;
    }

    const encrypted =
      await encryptDemoMessage(text);

    console.log(
      "Encrypted message demo:",
      encrypted
    );

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
  });

document
  .getElementById("startCall")
  .addEventListener("click", () => {
    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    alert(
      `Voice-call prototype started for ${selectedPerson.name}.`
    );
  });

document
  .getElementById("startVideoCall")
  .addEventListener("click", async () => {
    if (!selectedPerson) {
      alert("Choose a connection first.");
      return;
    }

    if (!navigator.mediaDevices) {
      alert(
        "Camera and microphone are not available here."
      );

      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });

      stream.getTracks().forEach((track) => {
        track.stop();
      });

      alert(
        `Camera and microphone permission granted for ${selectedPerson.name}.`
      );
    } catch (error) {
      alert(
        "Camera or microphone permission was not granted."
      );
    }
  });

renderPeople();
renderMessages();
updateLanguageButtons();
updatePhraseLabels();
updatePreview();