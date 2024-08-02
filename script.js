// 1. Constants and Variable Declarations
const WEATHER_API_KEY = "6294cf4c2ab4b8ededcaa9f9cbd85311";
let speechQueue = [];
let isSpeaking = false;
let isRecognitionActive = false;
let recognitionTimeout = null;

// 2. DOM Element Selections
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const voiceButton = document.getElementById("voice-button");
const stopButton = document.getElementById("voice-stop-button");
const menuButton = document.querySelector(".menu");
const dropdownContent = document.querySelector(".dropdown-content");
const newChatButton = document.getElementById("new-chat");

// 3. Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = "en-US";

// 4. Speech Synthesis Setup
const synth = window.speechSynthesis;

// 5. Utility Functions
function getTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDate() {
    const today = new Date();
    return today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function autoCorrectSpelling(sentence) {
    const corrections = { "wat": "what", "ur": "your" };
    const words = sentence.split(' ');
    return words.map(word => corrections[word.toLowerCase()] || word).join(' ');
}

function detectAbusiveLanguage(input) {
    const abusiveWords = ["Stupid", "fuck off", "mardarchod", "dengey", "fuck you", "bitch"];
    return abusiveWords.some(word => input.toLowerCase().includes(word));
}

function calculateMathExpression(expression) {
    try {
        const sanitizedExpression = expression.replace(/[^-()\d/*+.]/g, '');
        const result = eval(sanitizedExpression);
        return `${sanitizedExpression} is ${result}`;
    } catch {
        return "Sorry, I couldn't understand the math expression. Please try again.";
    }
}

function returnToHomePage() {
    window.location.href = 'index.html';
}

function checkSpeechSynthesisSupport() {
    if (!('speechSynthesis' in window)) {
        console.error('Speech synthesis not supported');
        addMessage("System", "Speech synthesis is not supported in this browser.");
        return false;
    }
    return true;
}

function loadVoices() {
    return new Promise((resolve) => {
        let voices = synth.getVoices();
        if (voices.length !== 0) {
            resolve(voices);
        } else {
            synth.onvoiceschanged = () => {
                voices = synth.getVoices();
                resolve(voices);
            };
        }
    });
}

// 6. Message Handling Functions
function addMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message-container");

    if (sender === "EVA") {
        messageElement.innerHTML = `
                    <p class="bot-message"><b>${sender}:</b> <span class="message-text">${message}</span></p>
                    <div class="message-actions">
                        <button class="action-button copy-button" title="Copy">
                            <i class="fas fa-copy copy-icon"></i>
                            <i class="fas fa-check check-icon" style="display: none;"></i>
                            <span class="copy-text">Copy</span>
                        </button>
                    </div>
                `;
        messageElement.classList.add("bot-container");
    } else if (sender === "You") {
        messageElement.innerHTML = `
                    <div class="user-message-wrapper">
                        <p class="user-message"><b>${sender}:</b> <span class="message-text">${message}</span></p>
                        <button class="edit-button"><i class="fas fa-edit"></i></button>
                    </div>
                `;
        messageElement.classList.add("user-container");
    } else {
        messageElement.innerHTML = `<p class="system-message">${message}</p>`;
    }

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function speakMessage(message) {
    speechQueue = [];
    synth.cancel();

    const chunks = splitIntoChunks(message);
    speechQueue = chunks;

    console.log("Speech queue:", speechQueue);

    if (!isSpeaking) {
        speakNext();
    }
}

function splitIntoChunks(text, maxLength = 200) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (let sentence of sentences) {
        if (currentChunk.length + sentence.length <= maxLength) {
            currentChunk += sentence + " ";
        } else {
            if (currentChunk) chunks.push(currentChunk.trim());
            currentChunk = sentence + " ";
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
}

function speakNext() {
    if (speechQueue.length > 0) {
        const chunk = speechQueue.shift();
        const utterance = new SpeechSynthesisUtterance(chunk);

        utterance.onend = () => {
            console.log("Finished speaking chunk:", chunk);
            isSpeaking = false;
            speakNext();
        };

        utterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance error:', event);
            isSpeaking = false;
            speakNext();
        };

        const voices = synth.getVoices();
        const preferredVoice = voices.find(voice => voice.name === 'Google UK English Female') || voices[0];
        utterance.voice = preferredVoice;

        isSpeaking = true;
        console.log("Speaking chunk:", chunk);
        synth.speak(utterance);
    } else {
        console.log("Finished speaking all chunks");
    }
}

// 7. Input Processing Functions
async function processUserInput(input) {
    input = input.toLowerCase();
    let response = "";

    if (input.includes("get back to homepage") || input.includes("return to homepage") || input.includes("return to home") || input.includes("back to home")) {
        response = "Certainly, I'll take you back to the home page.";
        setTimeout(returnToHomePage, 100);
        return response;
    }

    if (detectAbusiveLanguage(input)) {
        return "Please avoid using abusive language.";
    }

    if (input.includes("time") || input.includes("date")) {
        response += `The current time is ${getTime()} and today's date is ${getDate()}. `;
    }

    if (input.includes("temperature") || input.includes("weather")) {
        const cityMatches = input.match(/in ([a-zA-Z\s]+) and ([a-zA-Z\s]+)/);
        if (cityMatches) {
            const city1 = cityMatches[1].trim();
            const city2 = cityMatches[2].trim();
            response += await getWeather([city1, city2]) + " ";
        } else {
            const singleCityMatch = input.match(/in (.+)/);
            if (singleCityMatch) {
                const city = singleCityMatch[1].trim();
                response += await getWeather([city]) + " ";
            } else {
                response += "For weather information, please specify one or two city names. ";
            }
        }
    }
    console.log("Processing input:", input);
    const definitionMatch = input.match(/define (.+) in (\d+) lines?/i);
    if (definitionMatch) {
        console.log("Definition request detected");
        const topic = definitionMatch[1];
        const lines = parseInt(definitionMatch[2]);
        return await getDefinition(topic, lines);
    }
    if (input.includes("hello") || input.includes("hi") || input.includes("hey eva") || input.includes("eva") || input.includes("hey")) {
        response += "Hello! I'm your friendly bot, here to assist you with various topics. ";
    }

    if (input.includes("bye") || input.includes("goodbye")) {
        response += "Thank you for your time. I hope our interaction has been helpful. ";
    }

    if (input.includes("thank you") || input.includes("thankyou") || input.includes("thanks")) {
        response += "You're welcome. I'm glad I could be of assistance. ";
    }

    if (input.includes("what is your name") || input.includes("who are you") || input.includes("what's your name")) {
        response += "I'm EVA, a Conversational bot. How can I assist you further?";
    }

    if (input.includes("who created you") || input.includes("who made you") || input.includes("your creator")) {
        response += "Team Eureka have created me. ";
    }

    if (input.includes("what's my name") || input.includes("what is my name") || input.includes("do you know my name")) {
        response += "I don't know your name, and I don't have the capability to store data. ";
    }

    if (/[-+*/]/.test(input)) {
        response += calculateMathExpression(input) + " ";
    }

    if (input.includes("open")) {
        const openMatch = input.match(/open\s+(\S+)(?:\s+and\s+(search|play)\s+(.+))?/i);
        if (openMatch) {
            let [, website, action, query] = openMatch;
            const url = generateWebsiteUrl(website, action, query);
            response = openWebsite(url, website, action, query);
        } else {
            response = "I'm sorry, I couldn't understand which website you want to open. Can you please specify?";
        }
    }

    if (input.includes("search for song") || input.includes("find song") || input.includes("song search")) {
        const songQuery = input.replace(/(search for song|find song|song search)/i, "").trim();
        if (songQuery) {
            const songResult = await searchSpotifySongs(songQuery);
            response += songResult.html + " ";
            return { text: response.trim(), speech: response.replace(songResult.html, songResult.plain).trim() };
        } else {
            response += "What song would you like me to search for? ";
        }
    }

    if (input.includes("recommend songs") || input.includes("suggest songs")) {
        const moodMatch = input.match(/for (.*?) mood/i);
        const languageMatch = input.match(/in (.*?) language/i);

        if (moodMatch && languageMatch) {
            const mood = moodMatch[1].toLowerCase();
            const language = languageMatch[1].toLowerCase();
            const songResult = await getMoodBasedSongs(mood, language);
            response += songResult.html + " ";
            return { text: response.trim(), speech: response.replace(songResult.html, songResult.plain).trim() };
        } else {
            response += "To get song recommendations, please specify both the mood and language. For example: 'Recommend songs for happy mood in English language'.";
        }
    }

    const greetingResponse = getGreetingResponse(input);
    if (greetingResponse) {
        response += greetingResponse + " ";
    }

    if (!response) {
        response += await getDuckDuckGoAnswer(input) + " ";
    }

    return { text: response.trim(), speech: response.trim() };
}

async function handleUserInput(userMessage) {
    const correctedMessage = autoCorrectSpelling(userMessage);
    addMessage("You", correctedMessage);
    userInput.value = "";

    const aiResponse = await processUserInput(correctedMessage);
    addMessage("EVA", aiResponse.text);
    if (checkSpeechSynthesisSupport()) {
        console.log("Starting speech for response:", aiResponse.speech);
        speakMessage(aiResponse.speech);
    }
}

// 8. API Interaction Functions
async function getWeather(cities) {
    const weatherPromises = cities.map(async (city) => {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.cod === 200) {
                const temp = data.main.temp;
                const description = data.weather[0].description;
                return `The current temperature in ${city.charAt(0).toUpperCase() + city.slice(1)} is ${temp}°C, ${description}.`;
            } else {
                return `Weather info unavailable for ${city}. Please check the city name.`;
            }
        } catch (error) {
            return `Weather data error for ${city}: ${error}. Try again later.`;
        }
    });

    const results = await Promise.all(weatherPromises);
    return results.join(' ');
}

async function getDuckDuckGoAnswer(query) {
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
        const response = await fetch(url);
        const data = await response.json();
        return data.AbstractText || `I don't have a specific answer for "${query}". Can you try rephrasing your question?`;
    } catch (error) {
        return `An error occurred while searching for information about "${query}": ${error}.`;
    }
}

async function searchSpotifySongs(query) {
    const clientId = 'bc4b1464a18a483f923e8b0b53dc706d';
    const clientSecret = 'fdd4999d1dd5433ab98ca953082670f5';

    try {
        const authResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });
        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });
        const searchData = await searchResponse.json();

        if (searchData.tracks && searchData.tracks.items.length > 0) {
            let resultStringHTML = "Here are some songs I found based on your mood and language preference:\n<ol>";
            let resultStringPlain = "Here are some songs I found based on your mood and language preference:\n";
            searchData.tracks.items.forEach((track, index) => {
                let trackName = track.name.replace(/"/g, '').replace(/\s*\([^)]*\)/g, '');
                let artistName = track.artists[0].name.replace(/"/g, '');
                resultStringHTML += `<li>${trackName} by ${artistName}</li>`;
                resultStringPlain += `${index + 1}. ${trackName} by ${artistName}\n`;
            });
            resultStringHTML += "</ol>";
            return { html: resultStringHTML, plain: resultStringPlain };
        } else {
            return {
                html: "Sorry, I couldn't find any songs matching your mood and language preference.",
                plain: "Sorry, I couldn't find any songs matching your mood and language preference."
            };
        }
    } catch (error) {
        console.error('Error searching Spotify:', error);
        return {
            html: "An error occurred while searching for songs. Please try again later.",
            plain: "An error occurred while searching for songs. Please try again later."
        };
    }
}

async function getMoodBasedSongs(mood, language) {
    const moodKeywords = {
        happy: ["upbeat", "cheerful", "joyful"],
        sad: ["melancholy", "heartbreak", "tearjerker"],
        energetic: ["uplifting", "motivational", "pump up"],
        relaxed: ["chill", "calm", "soothing"],
        romantic: ["love", "passion", "romantic"],
    };

    const keywords = moodKeywords[mood] || [mood];
    const query = `${keywords.join(" OR ")} lang:${language}`;
    return await searchSpotifySongs(query);
}
async function getDefinition(topic, lines) {
    console.log(`Getting definition for ${topic} in ${lines} lines`); // Add this line for debugging
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic)}&format=json`);
        const data = await response.json();
        let definition = data.AbstractText || data.RelatedTopics[0]?.Text;

        if (!definition) {
            return {
                text: `I couldn't find a specific definition for "${topic}". To ask for definitions, use the format: "Define [topic] in [number] lines". For example, "Define artificial intelligence in 2 lines".`,
                speech: `I couldn't find a specific definition for "${topic}". To ask for definitions, use the format: Define, followed by the topic, then in, and the number of lines you want.`
            };
        }
        const sentences = definition.match(/[^.!?]+[.!?]+/g) || [definition];
        definition = sentences.slice(0, lines).join(' ');

        return {
            text: `Here's a ${lines}-line definition of ${topic}:\n${definition}`,
            speech: `Here's a ${lines}-line definition of ${topic}: ${definition}`
        };
    } catch (error) {
        console.error("Error in getDefinition:", error);
        return {
            text: `An error occurred while searching for a definition of "${topic}": ${error}. To ask for definitions, use the format: "Define [topic] in [number] lines".`,
            speech: `An error occurred while searching for a definition of "${topic}". To ask for definitions, use the format: Define, followed by the topic, then in, and the number of lines you want.`
        };
    }
}
function generateWebsiteUrl(website, action, query) {
    if (!website.includes('.')) {
        website += '.com';
    }

    let baseUrl = website.startsWith('http://') || website.startsWith('https://') ? website : 'https://' + website;

    if (action && query) {
        const encodedQuery = encodeURIComponent(query);
        if (website.includes('youtube.com')) {
            return `${baseUrl}/results?search_query=${encodedQuery}`;
        } else if (website.includes('google.com')) {
            return `${baseUrl}/search?q=${encodedQuery}`;
        } else {
            // Default search pattern for other websites
            return `${baseUrl}/search?q=${encodedQuery}`;
        }
    }

    return baseUrl;
}

function openWebsite(url, website, action, query) {
    let responseMessage = `Opening ${website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\.[^.]+$/, '')}`;

    if (action && query) {
        responseMessage += ` and ${action === 'play' ? 'searching to play' : 'searching for'} "${query}"`;
    }

    window.open(url, '_blank');
    return responseMessage;
}

function getGreetingResponse(input) {
    const greetings = {
        "good morning": "Good morning! I hope you're having a great start to your day.",
        "good afternoon": "Good afternoon! I hope your day is going well.",
        "good evening": "Good evening! I hope you've had a pleasant day.",
        "good night": "Good night! Sleep well and have a great rest.",
    };

    for (const [greeting, response] of Object.entries(greetings)) {
        if (input.includes(greeting)) {
            return response;
        }
    }
    return null;
}

// 9. Event Listeners
sendButton.addEventListener("click", () => {
    const userMessage = userInput.value.trim();
    if (userMessage) {
        handleUserInput(userMessage);
    }
});

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        sendButton.click();
    }
});

voiceButton.addEventListener("click", () => {
    if (!isRecognitionActive) {
        try {
            recognition.start();
            isRecognitionActive = true;
            addMessage("System", "Listening...");
            recognitionTimeout = setTimeout(() => {
                if (isRecognitionActive) {
                    recognition.stop();
                    addMessage("System", "Speech recognition timed out.");
                    isRecognitionActive = false;
                }
            }, 10000);
        } catch (error) {
            console.error("Error starting speech recognition:", error);
            addMessage("System", "Failed to start speech recognition. Please check your browser settings.");
            isRecognitionActive = false;
        }
    } else {
        addMessage("System", "Speech recognition is already active.");
    }
});

stopButton.addEventListener("click", () => {
    let actionTaken = false;

    if (isRecognitionActive) {
        clearTimeout(recognitionTimeout);
        recognition.stop();
        addMessage("System", "Speech recognition stopped.");
        isRecognitionActive = false;
        actionTaken = true;
    }

    if (synth.speaking || speechQueue.length > 0) {
        synth.cancel();
        speechQueue = [];
        isSpeaking = false;
        addMessage("System", "Speech output stopped.");
        actionTaken = true;
    }

    if (!actionTaken) {
        addMessage("System", "No active speech processes to stop.");
    }
});

chatContainer.addEventListener("click", async (event) => {
    if (event.target.closest(".edit-button")) {
        const messageContainer = event.target.closest(".message-container");
        const messageText = messageContainer.querySelector(".message-text").textContent;

        messageContainer.classList.add("editing");
        messageContainer.innerHTML = `
                    <div class="edit-wrapper" style="display: flex; justify-content: flex-end; width: 100%;">
                        <input type="text" class="edit-input" value="${messageText}" style="width: 70%;">
                        <button class="save-button">Save</button>
                    </div>
                `;

        const editInput = messageContainer.querySelector(".edit-input");
        editInput.focus();
        editInput.setSelectionRange(editInput.value.length, editInput.value.length);
    } else if (event.target.classList.contains("save-button")) {
        const messageContainer = event.target.closest(".message-container");
        const editInput = messageContainer.querySelector(".edit-input");
        const newMessage = editInput.value.trim();

        if (newMessage) {
            messageContainer.innerHTML = `
                        <div class="user-message-wrapper">
                            <p class="user-message"><b>You:</b> <span class="message-text">${newMessage}</span></p>
                            <button class="edit-button"><i class="fas fa-edit"></i></button>
                        </div>
                    `;
            messageContainer.classList.remove("editing");

            // Process the edited message
            const aiResponse = await processUserInput(newMessage);
            addMessage("EVA", aiResponse.text);
            if (checkSpeechSynthesisSupport()) {
                console.log("Starting speech for response:", aiResponse.speech);
                speakMessage(aiResponse.speech);
            }
        }
    }

    if (event.target.closest(".copy-button")) {
        const messageText = event.target.closest(".message-container").querySelector(".message-text").textContent;
        const copyButton = event.target.closest(".copy-button");
        const copyIcon = copyButton.querySelector(".copy-icon");
        const checkIcon = copyButton.querySelector(".check-icon");

        navigator.clipboard.writeText(messageText).then(() => {
            copyIcon.style.display = "none";
            checkIcon.style.display = "inline-block";
            copyButton.classList.add("clicked");

            setTimeout(() => {
                copyIcon.style.display = "inline-block";
                checkIcon.style.display = "none";
                copyButton.classList.remove("clicked");
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
});

recognition.onresult = (event) => {
    const userMessage = event.results[0][0].transcript;
    handleUserInput(userMessage);
};

recognition.onerror = (event) => {
    addMessage("System", "Error in speech recognition: " + event.error);
    isRecognitionActive = false;
};

recognition.onend = () => {
    if (isRecognitionActive) {
        isRecognitionActive = false;
    }
};

menuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
});

newChatButton.addEventListener("click", (e) => {
    e.preventDefault();
    location.reload();
});

document.addEventListener("click", (event) => {
    if (!event.target.matches('.menu') && !event.target.matches('.dropdown-content')) {
        dropdownContent.style.display = "none";
    }
});

// 10. Initialization
async function initializeSpeech() {
    if (checkSpeechSynthesisSupport()) {
        await loadVoices();
        console.log("Speech synthesis initialized");
    }
}

// Initial greeting
addMessage("EVA", "Hello! How can I assist you today?");
speakMessage("Welcome! How can I assist you today?");

// Initialize speech when the page loads
initializeSpeech();