// 1. Constants and Variable Declarations
const WEATHER_API_KEY = "6294cf4c2ab4b8ededcaa9f9cbd85311";
let speechQueue = [];
let isSpeaking = false;
let isRecognitionActive = false;
let recognitionTimeout = null;
let conversationHistory = [];

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
let recognition = null;
if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
}

// 4. Speech Synthesis Setup
const synth = window.speechSynthesis;

// 5. Enhanced Utility Functions
function getTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getDate() {
    const today = new Date();
    return today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function autoCorrectSpelling(sentence) {
    const corrections = { 
        "wat": "what", 
        "ur": "your", 
        "u": "you",
        "r": "are",
        "dont": "don't",
        "cant": "can't",
        "wont": "won't",
        "shouldnt": "shouldn't",
        "couldnt": "couldn't",
        "wouldnt": "wouldn't"
    };
    const words = sentence.split(' ');
    return words.map(word => {
        const lowerWord = word.toLowerCase();
        const punctuation = word.match(/[.,!?;:]$/);
        const cleanWord = word.replace(/[.,!?;:]$/, '');
        const corrected = corrections[cleanWord.toLowerCase()] || cleanWord;
        return corrected + (punctuation ? punctuation[0] : '');
    }).join(' ');
}

function detectAbusiveLanguage(input) {
    const abusiveWords = ["stupid", "fuck", "mardarchod", "dengey", "bitch", "damn", "shit"];
    const normalizedInput = input.toLowerCase().replace(/[^a-z\s]/g, '');
    return abusiveWords.some(word => normalizedInput.includes(word));
}

function calculateMathExpression(expression) {
    try {
        // More secure math evaluation
        const sanitizedExpression = expression.replace(/[^-()\d/*+.\s]/g, '');
        if (!sanitizedExpression.trim()) {
            return "Please provide a valid math expression.";
        }
        
        // Use Function constructor instead of eval for better security
        const result = new Function('return ' + sanitizedExpression)();
        
        if (typeof result !== 'number' || !isFinite(result)) {
            return "Invalid calculation result.";
        }
        
        return `${sanitizedExpression} = ${result}`;
    } catch (error) {
        console.error('Math calculation error:', error);
        return "Sorry, I couldn't understand the math expression. Please try again.";
    }
}

function returnToHomePage() {
    if (confirm("Are you sure you want to return to the home page?")) {
        window.location.href = 'index.html';
    }
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
            // Fallback timeout
            setTimeout(() => resolve(synth.getVoices()), 1000);
        }
    });
}

function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function logConversation(sender, message) {
    conversationHistory.push({
        sender: sender,
        message: message,
        timestamp: new Date().toISOString()
    });
    
    // Keep only last 50 messages to prevent memory issues
    if (conversationHistory.length > 50) {
        conversationHistory = conversationHistory.slice(-50);
    }
}

// 6. Enhanced Message Handling Functions
function addMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message-container");
    
    // Sanitize message content
    const sanitizedMessage = sanitizeHTML(message);
    
    logConversation(sender, message);

    if (sender === "EVA") {
        messageElement.innerHTML = `
            <p class="bot-message"><b>${sender}:</b> <span class="message-text">${sanitizedMessage}</span></p>
            <div class="message-actions">
                <button class="action-button copy-button" title="Copy" aria-label="Copy message">
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
                <p class="user-message"><b>${sender}:</b> <span class="message-text">${sanitizedMessage}</span></p>
                <button class="edit-button" aria-label="Edit message"><i class="fas fa-edit"></i></button>
            </div>
        `;
        messageElement.classList.add("user-container");
    } else {
        messageElement.innerHTML = `<p class="system-message">${sanitizedMessage}</p>`;
    }

    chatContainer.appendChild(messageElement);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function speakMessage(message) {
    if (!checkSpeechSynthesisSupport()) return;
    
    speechQueue = [];
    synth.cancel();

    // Clean message for speech (remove HTML tags and format lists)
    let cleanMessage = message.replace(/<br\s*\/?>/gi, '. ');
    cleanMessage = cleanMessage.replace(/<ol>/gi, '');
    cleanMessage = cleanMessage.replace(/<\/ol>/gi, '');
    cleanMessage = cleanMessage.replace(/<li>/gi, '');
    cleanMessage = cleanMessage.replace(/<\/li>/gi, '. ');
    cleanMessage = cleanMessage.replace(/<strong>/gi, '');
    cleanMessage = cleanMessage.replace(/<\/strong>/gi, '');
    cleanMessage = cleanMessage.replace(/<[^>]*>/g, '');
    cleanMessage = cleanMessage.replace(/&[^;]+;/g, '');
    cleanMessage = cleanMessage.replace(/\s+/g, ' ').trim();
    
    const chunks = splitIntoChunks(cleanMessage);
    speechQueue = chunks;

    console.log("Speech queue:", speechQueue);

    if (!isSpeaking && speechQueue.length > 0) {
        speakNext();
    }
}

function splitIntoChunks(text, maxLength = 200) {
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = "";

    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (currentChunk.length + sentence.length <= maxLength) {
            currentChunk += sentence + " ";
        } else {
            if (currentChunk.trim()) chunks.push(currentChunk.trim());
            currentChunk = sentence + " ";
        }
    }

    if (currentChunk.trim()) chunks.push(currentChunk.trim());
    return chunks.length > 0 ? chunks : [text];
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

        // Enhanced voice selection
        const voices = synth.getVoices();
        const preferredVoice = voices.find(voice => 
            voice.name.includes('Google') && voice.lang.startsWith('en')
        ) || voices.find(voice => voice.lang.startsWith('en')) || voices[0];
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }

        utterance.rate = 1.0; // Slightly faster speech
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        isSpeaking = true;
        console.log("Speaking chunk:", chunk);
        synth.speak(utterance);
    } else {
        console.log("Finished speaking all chunks");
        isSpeaking = false;
    }
}

// 7. Enhanced Input Processing Functions
async function processUserInput(input) {
    const originalInput = input;
    input = input.toLowerCase().trim();
    
    if (!input) {
        return { text: "I didn't receive any input. Please try again.", speech: "I didn't receive any input. Please try again." };
    }
    
    let response = "";

    // Navigation commands
    if (input.includes("get back to homepage") || input.includes("return to homepage") || input.includes("return to home") || input.includes("back to home")) {
        response = "Certainly, I'll take you back to the home page.";
        setTimeout(returnToHomePage, 1000);
        return { text: response, speech: response };
    }

    // Abuse filter
    if (detectAbusiveLanguage(input)) {
        const responses = [
            "Please use respectful language in our conversation.",
            "I'd prefer if we could keep our conversation polite and respectful.",
            "Let's maintain a friendly tone in our chat."
        ];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        return { text: randomResponse, speech: randomResponse };
    }

    // Time and date queries
    if (input.includes("time") || input.includes("date")) {
        if (input.includes("time") && input.includes("date")) {
            response += `The current time is ${getTime()} and today's date is ${getDate()}. `;
        } else if (input.includes("time")) {
            response += `The current time is ${getTime()}. `;
        } else {
            response += `Today's date is ${getDate()}. `;
        }
    }

    // Weather queries with improved parsing
    if (input.includes("temperature") || input.includes("weather")) {
        const cityMatches = input.match(/(?:in|for)\s+([a-zA-Z\s]+?)(?:\s+and\s+([a-zA-Z\s]+?))?(?:\s|$|[?!.])/);
        if (cityMatches) {
            const cities = [cityMatches[1].trim()];
            if (cityMatches[2]) {
                cities.push(cityMatches[2].trim());
            }
            response += await getWeather(cities) + " ";
        } else {
            response += "For weather information, please specify a city name. For example: 'What's the weather in New York?' ";
        }
    }

    // Definition queries
    const definitionMatch = input.match(/define (.+?)(?:\s+in\s+(\d+)\s+lines?)?$/i);
    if (definitionMatch) {
        const topic = definitionMatch[1];
        const lines = definitionMatch[2] ? parseInt(definitionMatch[2]) : 3;
        const definitionResult = await getDefinition(topic, lines);
        return {
            text: definitionResult.text || definitionResult,
            speech: definitionResult.speech || definitionResult.text || definitionResult
        };
    }

    // Greetings
    if (/\b(hello|hi|hey)\b/.test(input) || input.includes("eva")) {
        const greetings = [
            "Hello! I'm EVA, your friendly assistant. How can I help you today?",
            "Hi there! I'm here to help you with various questions and tasks.",
            "Hey! Great to chat with you. What can I assist you with?"
        ];
        response += greetings[Math.floor(Math.random() * greetings.length)] + " ";
    }

    // Farewells
    if (/\b(bye|goodbye|see you|farewell)\b/.test(input)) {
        const farewells = [
            "Goodbye! It was great chatting with you.",
            "See you later! Feel free to come back anytime.",
            "Farewell! Hope I was helpful today."
        ];
        response += farewells[Math.floor(Math.random() * farewells.length)] + " ";
    }

    // Thanks
    if (/\b(thank you|thanks|thankyou)\b/.test(input)) {
        const thankResponses = [
            "You're welcome! Happy to help.",
            "My pleasure! Let me know if you need anything else.",
            "Glad I could help! Is there anything else you'd like to know?"
        ];
        response += thankResponses[Math.floor(Math.random() * thankResponses.length)] + " ";
    }

    // Identity questions
    if (input.includes("what is your name") || input.includes("who are you") || input.includes("what's your name")) {
        response += "I'm EVA, your conversational AI assistant. I'm here to help with questions, provide information, and have friendly chats. ";
    }

    if (input.includes("who created you") || input.includes("who made you") || input.includes("your creator")) {
        response += "I was created by Team Eureka. They designed me to be helpful, informative, and friendly. ";
    }

    if (input.includes("what's my name") || input.includes("what is my name") || input.includes("do you know my name")) {
        response += "I don't have access to your personal information, including your name. Each conversation with me starts fresh. ";
    }

    // Math expressions - Enhanced to handle percentages
    if (/[\d\s]*[-+*/%]\s*[\d\s]/.test(input) || input.includes("percent") || input.includes("%")) {
        if (input.includes("%") || input.includes("percent")) {
            const percentMatch = input.match(/(\d+)%?\s*of\s*(\d+)/i);
            if (percentMatch) {
                const percentage = parseFloat(percentMatch[1]);
                const number = parseFloat(percentMatch[2]);
                const result = (percentage / 100) * number;
                response += `${percentage}% of ${number} = ${result}. `;
            } else {
                response += calculateMathExpression(input) + " ";
            }
        } else {
            response += calculateMathExpression(input) + " ";
        }
    }

    // Website opening
    if (input.includes("open")) {
        const openMatch = input.match(/open\s+(\S+)(?:\s+and\s+(search|play)\s+(.+))?/i);
        if (openMatch) {
            let [, website, action, query] = openMatch;
            const url = generateWebsiteUrl(website, action, query);
            response += openWebsite(url, website, action, query) + " ";
        } else {
            response += "I'm sorry, I couldn't understand which website you want to open. Please specify the website name. ";
        }
    }

    // Music search
    if (input.includes("search for song") || input.includes("find song") || input.includes("song search")) {
        const songQuery = input.replace(/(search for song|find song|song search)/i, "").trim();
        if (songQuery) {
            const songResult = await searchSpotifySongs(songQuery);
            response += songResult.plain + " ";
            return { text: songResult.html, speech: songResult.plain };
        } else {
            response += "What song would you like me to search for? Please be more specific. ";
        }
    }

    // Song recommendations
    if (input.includes("recommend songs") || input.includes("suggest songs")) {
        const moodMatch = input.match(/for\s+(\w+)\s+mood/i);
        const languageMatch = input.match(/in\s+(\w+)\s+language/i);

        if (moodMatch && languageMatch) {
            const mood = moodMatch[1].toLowerCase();
            const language = languageMatch[1].toLowerCase();
            const songResult = await getMoodBasedSongs(mood, language);
            response += songResult.plain + " ";
            return { text: songResult.html, speech: songResult.plain };
        } else {
            response += "To get song recommendations, please specify both the mood and language. For example: 'Recommend songs for happy mood in English language'. ";
        }
    }

    // Time-based greetings
    const greetingResponse = getGreetingResponse(input);
    if (greetingResponse) {
        response += greetingResponse + " ";
    }

    // Fallback to search if no specific response
    if (!response.trim()) {
        response += await getDuckDuckGoAnswer(originalInput) + " ";
    }

    return { text: response.trim(), speech: response.trim() };
}

async function handleUserInput(userMessage) {
    if (!userMessage || !userMessage.trim()) {
        addMessage("System", "Please enter a message.");
        return;
    }

    const correctedMessage = autoCorrectSpelling(userMessage);
    addMessage("You", correctedMessage);
    userInput.value = "";

    try {
        const aiResponse = await processUserInput(correctedMessage);
        const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;
        const speechText = typeof aiResponse === 'string' ? aiResponse : aiResponse.speech;
        
        addMessage("EVA", responseText);
        
        if (checkSpeechSynthesisSupport()) {
            console.log("Starting speech for response:", speechText);
            speakMessage(speechText);
        }
    } catch (error) {
        console.error('Error processing user input:', error);
        addMessage("EVA", "Sorry, I encountered an error while processing your request. Please try again.");
    }
}

// 8. Enhanced API Interaction Functions
async function getWeather(cities) {
    const weatherPromises = cities.map(async (city) => {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.cod === 200) {
                const temp = Math.round(data.main.temp);
                const description = data.weather[0].description;
                const humidity = data.main.humidity;
                return `In ${city.charAt(0).toUpperCase() + city.slice(1)}: ${temp}°C, ${description}, humidity ${humidity}%.`;
            } else {
                return `Weather information unavailable for ${city}. Please check the city name.`;
            }
        } catch (error) {
            console.error(`Weather API error for ${city}:`, error);
            return `Unable to get weather data for ${city}. Please try again later.`;
        }
    });

    try {
        const results = await Promise.all(weatherPromises);
        return results.join(' ');
    } catch (error) {
        console.error('Weather data error:', error);
        return "Sorry, I'm having trouble getting weather information right now.";
    }
}

async function getDuckDuckGoAnswer(query) {
    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.AbstractText) {
            return data.AbstractText;
        } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
            return data.RelatedTopics[0].Text || "I couldn't find specific information about that topic.";
        } else {
            return `I don't have detailed information about "${query}". Could you try rephrasing your question or being more specific?`;
        }
    } catch (error) {
        console.error('DuckDuckGo API error:', error);
        return `I'm having trouble searching for information about "${query}" right now. Please try again later.`;
    }
}

async function searchSpotifySongs(query) {
    const clientId = 'bc4b1464a18a483f923e8b0b53dc706d';
    const clientSecret = 'fdd4999d1dd5433ab98ca953082670f5';

    try {
        // Get access token
        const authResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
            },
            body: 'grant_type=client_credentials'
        });

        if (!authResponse.ok) {
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        const accessToken = authData.access_token;

        // Search for songs
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });

        if (!searchResponse.ok) {
            throw new Error(`Search failed: ${searchResponse.status}`);
        }

        const searchData = await searchResponse.json();

        if (searchData.tracks && searchData.tracks.items.length > 0) {
            let resultStringHTML = "Here are some songs I found:<br><ol>";
            let resultStringPlain = "Here are some songs I found:\n";
            
            searchData.tracks.items.forEach((track, index) => {
                const trackName = track.name.replace(/"/g, '').replace(/\s*\([^)]*\)/g, '');
                const artistName = track.artists[0].name.replace(/"/g, '');
                resultStringHTML += `<li><strong>${trackName}</strong> by ${artistName}</li>`;
                resultStringPlain += `${index + 1}. ${trackName} by ${artistName}\n`;
            });
            
            resultStringHTML += "</ol>";
            return { html: resultStringHTML, plain: resultStringPlain.trim() };
        } else {
            const message = "Sorry, I couldn't find any songs matching your search.";
            return { html: message, plain: message };
        }
    } catch (error) {
        console.error('Spotify search error:', error);
        const errorMessage = "I'm having trouble searching for songs right now. Please try again later.";
        return { html: errorMessage, plain: errorMessage };
    }
}

async function getMoodBasedSongs(mood, language) {
    const moodKeywords = {
        happy: ["upbeat", "cheerful", "joyful", "energetic"],
        sad: ["melancholy", "heartbreak", "emotional", "slow"],
        energetic: ["uplifting", "motivational", "pump up", "workout"],
        relaxed: ["chill", "calm", "soothing", "ambient"],
        romantic: ["love", "passion", "romantic", "ballad"],
        party: ["dance", "club", "party", "upbeat"]
    };

    const keywords = moodKeywords[mood.toLowerCase()] || [mood];
    const query = `${keywords[0]} ${language}`;
    return await searchSpotifySongs(query);
}

async function getDefinition(topic, lines = 3) {
    console.log(`Getting definition for ${topic} in ${lines} lines`);
    
    try {
        const response = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(topic + " definition")}&format=json`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        let definition = data.AbstractText;
        
        if (!definition && data.RelatedTopics && data.RelatedTopics.length > 0) {
            definition = data.RelatedTopics[0].Text;
        }

        if (!definition) {
            return {
                text: `I couldn't find a specific definition for "${topic}". Try asking about a more common term or rephrase your question.`,
                speech: `I couldn't find a specific definition for "${topic}". Try asking about a more common term or rephrase your question.`
            };
        }

        const sentences = definition.match(/[^.!?]+[.!?]+/g) || [definition];
        const limitedDefinition = sentences.slice(0, lines).join(' ').trim();

        return {
            text: `Here's a ${lines}-line definition of <strong>${topic}</strong>:<br><br>${limitedDefinition}`,
            speech: `Here's a ${lines}-line definition of ${topic}: ${limitedDefinition}`
        };
    } catch (error) {
        console.error("Error in getDefinition:", error);
        return {
            text: `I'm having trouble getting a definition for "${topic}" right now. Please try again later.`,
            speech: `I'm having trouble getting a definition for "${topic}" right now. Please try again later.`
        };
    }
}

function generateWebsiteUrl(website, action, query) {
    // Add .com if no domain extension
    if (!website.includes('.')) {
        website += '.com';
    }

    // Ensure protocol
    let baseUrl = website.startsWith('http://') || website.startsWith('https://') ? 
                  website : 'https://' + website;

    if (action && query) {
        const encodedQuery = encodeURIComponent(query);
        if (website.includes('youtube')) {
            return `${baseUrl}/results?search_query=${encodedQuery}`;
        } else if (website.includes('google')) {
            return `${baseUrl}/search?q=${encodedQuery}`;
        } else if (website.includes('amazon')) {
            return `${baseUrl}/s?k=${encodedQuery}`;
        } else if (website.includes('wikipedia')) {
            return `${baseUrl}/wiki/Special:Search?search=${encodedQuery}`;
        } else {
            return `${baseUrl}/search?q=${encodedQuery}`;
        }
    }

    return baseUrl;
}

function openWebsite(url, website, action, query) {
    try {
        const siteName = website.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\.[^.]+$/, '');
        let responseMessage = `Opening ${siteName}`;

        if (action && query) {
            responseMessage += ` and ${action === 'play' ? 'searching to play' : 'searching for'} "${query}"`;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
        return responseMessage + ".";
    } catch (error) {
        console.error('Error opening website:', error);
        return "Sorry, I couldn't open that website.";
    }
}

function getGreetingResponse(input) {
    const currentHour = new Date().getHours();
    
    const greetings = {
        "good morning": currentHour < 12 ? "Good morning! I hope you're having a great start to your day." : "Good morning! Though it's past noon here, I hope your day is going well.",
        "good afternoon": currentHour >= 12 && currentHour < 17 ? "Good afternoon! I hope your day is going well." : "Good afternoon! I hope you're having a nice day.",
        "good evening": currentHour >= 17 ? "Good evening! I hope you've had a pleasant day." : "Good evening! Though it's still early, I hope your day has been good.",
        "good night": "Good night! Sleep well and have sweet dreams.",
    };

    for (const [greeting, response] of Object.entries(greetings)) {
        if (input.includes(greeting)) {
            return response;
        }
    }
    return null;
}

// 9. Enhanced Event Listeners
sendButton.addEventListener("click", () => {
    const userMessage = userInput.value.trim();
    if (userMessage) {
        handleUserInput(userMessage);
    }
});

userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendButton.click();
    }
});

// Enhanced voice button with better error handling
voiceButton.addEventListener("click", () => {
    if (!recognition) {
        addMessage("System", "Speech recognition is not supported in this browser.");
        return;
    }

    if (!isRecognitionActive) {
        try {
            recognition.start();
            isRecognitionActive = true;
            addMessage("System", "🎤 Listening...");
            
            recognitionTimeout = setTimeout(() => {
                if (isRecognitionActive) {
                    recognition.stop();
                    addMessage("System", "Speech recognition timed out. Please try again.");
                    isRecognitionActive = false;
                }
            }, 10000);
        } catch (error) {
            console.error("Error starting speech recognition:", error);
            addMessage("System", "Failed to start speech recognition. Please check your microphone permissions.");
            isRecognitionActive = false;
        }
    } else {
        addMessage("System", "Speech recognition is already active. Please wait.");
    }
});

stopButton.addEventListener("click", () => {
    let actionTaken = false;

    if (isRecognitionActive) {
        clearTimeout(recognitionTimeout);
        if (recognition) {
            recognition.stop();
        }
        addMessage("System", "🛑 Speech recognition stopped.");
        isRecognitionActive = false;
        actionTaken = true;
    }

    if (synth.speaking || speechQueue.length > 0) {
        synth.cancel();
        speechQueue = [];
        isSpeaking = false;
        addMessage("System", "🔇 Speech output stopped.");
        actionTaken = true;
    }

    if (!actionTaken) {
        addMessage("System", "No active speech processes to stop.");
    }
});

// Enhanced chat container event handling
chatContainer.addEventListener("click", async (event) => {
    if (event.target.closest(".edit-button")) {
        const messageContainer = event.target.closest(".message-container");
        const messageText = messageContainer.querySelector(".message-text").textContent;

        messageContainer.classList.add("editing");
        messageContainer.innerHTML = `
            <div class="edit-wrapper" style="display: flex; justify-content: flex-end; width: 100%; gap: 10px; align-items: center;">
                <input type="text" class="edit-input" value="${messageText}" style="flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
                <button class="save-button" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
                <button class="cancel-button" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
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
                    <p class="user-message"><b>You:</b> <span class="message-text">${sanitizeHTML(newMessage)}</span></p>
                    <button class="edit-button" aria-label="Edit message"><i class="fas fa-edit"></i></button>
                </div>
            `;
            messageContainer.classList.remove("editing");

            // Process the edited message
            try {
                const aiResponse = await processUserInput(newMessage);
                const responseText = typeof aiResponse === 'string' ? aiResponse : aiResponse.text;
                const speechText = typeof aiResponse === 'string' ? aiResponse : aiResponse.speech;
                
                addMessage("EVA", responseText);
                
                if (checkSpeechSynthesisSupport()) {
                    console.log("Starting speech for edited message response:", speechText);
                    speakMessage(speechText);
                }
            } catch (error) {
                console.error('Error processing edited message:', error);
                addMessage("EVA", "Sorry, I encountered an error while processing your edited message.");
            }
        }
        
    } else if (event.target.classList.contains("cancel-button")) {
        const messageContainer = event.target.closest(".message-container");
        const originalMessage = messageContainer.querySelector(".edit-input").defaultValue;
        
        messageContainer.innerHTML = `
            <div class="user-message-wrapper">
                <p class="user-message"><b>You:</b> <span class="message-text">${sanitizeHTML(originalMessage)}</span></p>
                <button class="edit-button" aria-label="Edit message"><i class="fas fa-edit"></i></button>
            </div>
        `;
        messageContainer.classList.remove("editing");
    }

    // Enhanced copy functionality
    if (event.target.closest(".copy-button")) {
        const messageText = event.target.closest(".message-container").querySelector(".message-text").textContent;
        const copyButton = event.target.closest(".copy-button");
        const copyIcon = copyButton.querySelector(".copy-icon");
        const checkIcon = copyButton.querySelector(".check-icon");
        const copyText = copyButton.querySelector(".copy-text");

        try {
            await navigator.clipboard.writeText(messageText);
            
            copyIcon.style.display = "none";
            checkIcon.style.display = "inline-block";
            copyText.textContent = "Copied!";
            copyButton.classList.add("clicked");

            setTimeout(() => {
                copyIcon.style.display = "inline-block";
                checkIcon.style.display = "none";
                copyText.textContent = "Copy";
                copyButton.classList.remove("clicked");
            }, 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
            copyText.textContent = "Failed";
            setTimeout(() => {
                copyText.textContent = "Copy";
            }, 2000);
        }
    }
});

// Enhanced speech recognition event handlers
if (recognition) {
    recognition.onresult = (event) => {
        clearTimeout(recognitionTimeout);
        const userMessage = event.results[0][0].transcript;
        console.log("Speech recognition result:", userMessage);
        handleUserInput(userMessage);
        isRecognitionActive = false;
    };

    recognition.onerror = (event) => {
        clearTimeout(recognitionTimeout);
        console.error("Speech recognition error:", event.error);
        
        let errorMessage = "Speech recognition error: ";
        switch (event.error) {
            case 'no-speech':
                errorMessage += "No speech detected. Please try again.";
                break;
            case 'audio-capture':
                errorMessage += "No microphone found. Please check your microphone.";
                break;
            case 'not-allowed':
                errorMessage += "Microphone access denied. Please allow microphone access.";
                break;
            case 'network':
                errorMessage += "Network error. Please check your internet connection.";
                break;
            default:
                errorMessage += event.error + ". Please try again.";
        }
        
        addMessage("System", errorMessage);
        isRecognitionActive = false;
    };

    recognition.onend = () => {
        clearTimeout(recognitionTimeout);
        if (isRecognitionActive) {
            isRecognitionActive = false;
        }
    };

    recognition.onstart = () => {
        console.log("Speech recognition started");
    };
}

// Menu and dropdown handling
menuButton.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownContent.style.display = dropdownContent.style.display === "block" ? "none" : "block";
});

newChatButton.addEventListener("click", (e) => {
    e.preventDefault();
    if (confirm("Are you sure you want to start a new chat? This will clear all current messages.")) {
        // Clear conversation history
        conversationHistory = [];
        
        // Clear chat container
        chatContainer.innerHTML = "";
        
        // Stop any ongoing speech
        synth.cancel();
        speechQueue = [];
        isSpeaking = false;
        
        // Reset recognition state
        if (isRecognitionActive && recognition) {
            recognition.stop();
            isRecognitionActive = false;
        }
        
        // Add initial greeting
        addMessage("EVA", "Hello! How can I assist you today?");
        speakMessage("Hello! How can I assist you today?");
        
        // Hide dropdown
        dropdownContent.style.display = "none";
    }
});

// Close dropdown when clicking outside
document.addEventListener("click", (event) => {
    if (!event.target.matches('.menu') && !event.target.closest('.dropdown-content')) {
        dropdownContent.style.display = "none";
    }
});

// Handle page visibility changes
document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        // Stop speech when page is hidden
        synth.cancel();
        speechQueue = [];
        isSpeaking = false;
    }
});

// Handle beforeunload
window.addEventListener("beforeunload", (e) => {
    if (conversationHistory.length > 1) {
        e.preventDefault();
        e.returnValue = "Are you sure you want to leave? Your conversation will be lost.";
    }
});

// 10. Enhanced Initialization
async function initializeSpeech() {
    if (checkSpeechSynthesisSupport()) {
        try {
            await loadVoices();
            console.log("Speech synthesis initialized successfully");
        } catch (error) {
            console.error("Speech synthesis initialization error:", error);
        }
    }
}

function initializeApp() {
    // Check for required DOM elements
    const requiredElements = [
        'chat-container', 'user-input', 'send-button', 
        'voice-button', 'voice-stop-button'
    ];
    
    const missingElements = requiredElements.filter(id => !document.getElementById(id));
    
    if (missingElements.length > 0) {
        console.error('Missing required DOM elements:', missingElements);
        return;
    }

    // Set input placeholder
    if (userInput) {
        userInput.placeholder = "Type your message here... (Press Enter to send)";
    }

    // Add initial greeting
    const initialGreeting = "Hello! I'm EVA, your friendly AI assistant. I can help you with weather information, answer questions, do math calculations, search for songs, and much more. How can I assist you today?";
    addMessage("EVA", initialGreeting);
    
    // Speak the complete initial greeting after a short delay
    setTimeout(() => {
        speakMessage(initialGreeting);
    }, 500);

    console.log("EVA chatbot initialized successfully");
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
        initializeSpeech();
    });
} else {
    initializeApp();
    initializeSpeech();
}

// Error handling for unhandled errors
window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
    addMessage("System", "An unexpected error occurred. Please refresh the page if problems persist.");
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processUserInput,
        calculateMathExpression,
        autoCorreectSpelling,
        detectAbusiveLanguage,
        getTime,
        getDate
    };
}
