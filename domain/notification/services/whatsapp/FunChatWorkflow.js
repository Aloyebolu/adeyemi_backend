// FunChatWorkflow.js
class FunChatWorkflow {
    constructor() {
        this.JOKES = [
            { setup: "Why don't scientists trust atoms? 💭", punchline: "Because they make up everything! 🔬😂" },
            { setup: "What do you call a fake noodle? 🍜", punchline: "An impasta! 🤌😆" },
            { setup: "Why did the student eat his homework? 📚", punchline: "Because the teacher said it was a piece of cake! 🍰🤣" },
            { setup: "What's a computer's favorite beat? 💻", punchline: "An algorithm! 🎵😎" },
            { setup: "Why did the math book look so sad? 📖", punchline: "Because it had too many problems! ➗😢" }
        ];
        
        this.RIDDLES = [
            { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I? 🌬️", answer: "echo", hint: "It bounces back..." },
            { question: "What has keys but can't open locks? 🎹", answer: "piano", hint: "It makes music..." },
            { question: "What gets wetter as it dries? 🧖", answer: "towel", hint: "You use it after a shower..." },
            { question: "What has a face and two hands but no arms or legs? ⏰", answer: "clock", hint: "It tells time..." }
        ];
        
        this.FUN_FACTS = [
            "🐘 Did you know? Elephants are the only mammals that can't jump!",
            "🍌 Bananas are berries, but strawberries aren't! 🤯",
            "🦒 A group of giraffes is called a 'tower'!",
            "💧 Hot water freezes faster than cold water. It's called the Mpemba effect!",
            "😴 You burn more calories sleeping than watching TV!"
        ];
        
        this.TRIVIA_QUESTIONS = [
            { q: "What's the largest ocean on Earth? 🌊", a: "pacific", options: ["Atlantic", "Indian", "Pacific", "Arctic"] },
            { q: "Who painted the Mona Lisa? 🎨", a: "da vinci", options: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"] },
            { q: "What's the fastest animal on land? 🦁", a: "cheetah", options: ["Lion", "Cheetah", "Leopard", "Horse"] },
            { q: "What's the tallest mountain in the world? 🏔️", a: "everest", options: ["K2", "Kangchenjunga", "Everest", "Makalu"] }
        ];
    }
    
    async execute(context) {
        const { conversationState, originalMessage } = context;
        
        if (!conversationState.funMode) {
            conversationState.funMode = {
                activeGame: null,
                gameState: null,
                funCount: 0,
                lastFunInteraction: Date.now()
            };
        }
        
        const funState = conversationState.funMode;
        funState.funCount++;
        funState.lastFunInteraction = Date.now();
        
        const intent = this.detectFunIntent(originalMessage);
        
        switch(intent) {
            case 'JOKE':
                return this.tellJoke();
            case 'RIDDLE':
                return this.startRiddle(context);
            case 'FUN_FACT':
                return this.shareFunFact();
            case 'TRIVIA':
                return this.startTrivia(context);
            default:
                return this.playfulChatter(originalMessage);
        }
    }
    
    detectFunIntent(message) {
        const lower = message.toLowerCase();
        
        if (/(joke|funny|lol|haha|😂|🤣)/i.test(lower)) return 'JOKE';
        if (/(riddle|puzzle|brain\s*teaser)/i.test(lower)) return 'RIDDLE';
        if (/(fun fact|did you know|interesting fact|tell me something)/i.test(lower)) return 'FUN_FACT';
        if (/(trivia|quiz|game|play)/i.test(lower)) return 'TRIVIA';
        
        return 'PLAYFUL';
    }
    
    tellJoke() {
        const joke = this.JOKES[Math.floor(Math.random() * this.JOKES.length)];
        
        return {
            requiresMoreInfo: false,
            message: `🎭 *JOKE TIME* 🎭\n━━━━━━━━━━━━━━━━\n\n${joke.setup}\n\n...\n\n${joke.punchline}\n\n😄 *Want another?* Just say "another joke" or "tell me a joke"!`
        };
    }
    
    startRiddle(context) {
        const riddle = this.RIDDLES[Math.floor(Math.random() * this.RIDDLES.length)];
        
        return {
            requiresMoreInfo: true,
            nextStep: 'answering_riddle',
            prompt: `🧩 *RIDDLE ME THIS* 🧩\n━━━━━━━━━━━━━━━━\n\n${riddle.question}\n\n💭 *Type your answer!*\n\n_Need a hint? Say "hint"_ 🤔\n_Or say "skip" to get a new riddle._\n_Or say "quit riddle" to stop._`,
            collectedData: { currentRiddle: riddle, attempts: 0 }
        };
    }
    
    shareFunFact() {
        const fact = this.FUN_FACTS[Math.floor(Math.random() * this.FUN_FACTS.length)];
        
        return {
            requiresMoreInfo: false,
            message: `🤯 *FUN FACT* 🤯\n━━━━━━━━━━━━━━━━\n\n${fact}\n\n🌟 *Your brain just grew a little!*\n\nSay "another fact" to keep learning! 🧠`
        };
    }
    
    startTrivia(context) {
        const firstQ = this.TRIVIA_QUESTIONS[0];
        
        return {
            requiresMoreInfo: true,
            nextStep: 'playing_trivia',
            prompt: `🎮 *TRIVIA TIME!* 🎮\n━━━━━━━━━━━━━━━━\n\n*Question 1/${this.TRIVIA_QUESTIONS.length}:*\n${firstQ.q}\n\n*Options:*\n${firstQ.options.map((opt, i) => `${i+1}. ${opt}`).join('\n')}\n\n💬 *Type the number or your answer!*\n_Or say "quit trivia" to stop._`,
            collectedData: {
                questions: [...this.TRIVIA_QUESTIONS],
                currentIndex: 0,
                score: 0
            }
        };
    }
    
    playfulChatter(message) {
        return {
            requiresMoreInfo: false,
            message: `😜 *"${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"* 😜\n━━━━━━━━━━━━━━━━\n\n*Choose fun:*\n🎭 Joke | 🧩 Riddle | 📚 Fun Fact | 🎮 Trivia`
        };
    }
    
    async processStep(context) {
        const { step, userResponse, collectedData, conversationState } = context;
        
        switch(step) {
            case 'answering_riddle':
                return this.processRiddleAnswer(userResponse, collectedData, conversationState);
            case 'playing_trivia':
                return this.processTriviaAnswer(userResponse, collectedData, conversationState);
            default:
                return {
                    completed: true,
                    message: "🎮 *Game error*\n\nPlease start over with a new game."
                };
        }
    }
    
    processRiddleAnswer(userResponse, collectedData, conversationState) {
        const { currentRiddle, attempts } = collectedData;
        const answer = userResponse.toLowerCase().trim();
        
        if (answer === 'quit riddle') {
            conversationState.activeWorkflow = null;
            return {
                completed: true,
                message: "🏁 *RIDDLE ENDED* 🏁\n━━━━━━━━━━━━━━━━\n\nThanks for playing! Say \"riddle\" anytime to play again! 🧩"
            };
        }
        
        if (answer === 'hint') {
            return {
                completed: false,
                nextStep: 'answering_riddle',
                message: `💡 *HINT* 💡\n━━━━━━━━━━━━━━━━\n\n${currentRiddle.hint}\n\n*Your riddle:* ${currentRiddle.question}\n\n🤔 *Try again!*`,
                collectedData: { ...collectedData, attempts: attempts + 1 }
            };
        }
        
        if (answer === 'skip') {
            const newRiddle = this.RIDDLES[Math.floor(Math.random() * this.RIDDLES.length)];
            return {
                completed: false,
                nextStep: 'answering_riddle',
                message: `⏭️ *SKIPPED!* ⏭️\n━━━━━━━━━━━━━━━━\n\nHere's a new riddle:\n\n${newRiddle.question}\n\n💭 *What's your answer?*`,
                collectedData: { currentRiddle: newRiddle, attempts: 0 }
            };
        }
        
        const isCorrect = answer === currentRiddle.answer || 
                         answer.includes(currentRiddle.answer) ||
                         currentRiddle.answer.includes(answer);
        
        if (isCorrect) {
            conversationState.activeWorkflow = null;
            return {
                completed: true,
                message: `✅ *CORRECT!* ✅\n━━━━━━━━━━━━━━━━\n\nAmazing! 🎉\n\nThe answer was: *${currentRiddle.answer.toUpperCase()}*\n\n🧠 *You're a riddle master!*\n\nWant another? Just say "riddle" again!`
            };
        } else {
            const newAttempts = (attempts || 0) + 1;
            
            if (newAttempts >= 3) {
                conversationState.activeWorkflow = null;
                return {
                    completed: true,
                    message: `😅 *OUT OF ATTEMPTS* 😅\n━━━━━━━━━━━━━━━━\n\nThe answer was: *${currentRiddle.answer.toUpperCase()}*\n\n💪 *Try another riddle!* Just say "riddle" to try again.`
                };
            }
            
            return {
                completed: false,
                nextStep: 'answering_riddle',
                message: `❌ *NOPE!* ❌\n━━━━━━━━━━━━━━━━\n\nThat's not it. Try again!\n\n*Hint:* ${currentRiddle.hint}\n\n📝 *Attempts left:* ${3 - newAttempts}\n\n_Type "hint" for more help or "skip" for a new riddle._`,
                collectedData: { ...collectedData, attempts: newAttempts }
            };
        }
    }
    
    processTriviaAnswer(userResponse, collectedData, conversationState) {
        const { questions, currentIndex, score } = collectedData;
        const currentQ = questions[currentIndex];
        const answer = userResponse.toLowerCase().trim();
        
        if (answer === 'quit trivia') {
            conversationState.activeWorkflow = null;
            return {
                completed: true,
                message: `🏁 *TRIVIA ENDED* 🏁\n━━━━━━━━━━━━━━━━\n\n*Final Score:* ${score}/${currentIndex}\n\nThanks for playing! 🎮\n\nSay "trivia" to play again!`
            };
        }
        
        let isCorrect = false;
        const optionIndex = parseInt(answer) - 1;
        if (!isNaN(optionIndex) && currentQ.options[optionIndex]) {
            isCorrect = currentQ.options[optionIndex].toLowerCase() === currentQ.a;
        } else if (answer === currentQ.a || currentQ.a.includes(answer) || answer.includes(currentQ.a)) {
            isCorrect = true;
        }
        
        const newScore = isCorrect ? score + 1 : score;
        const nextIndex = currentIndex + 1;
        
        if (nextIndex >= questions.length) {
            conversationState.activeWorkflow = null;
            const percent = (newScore / questions.length) * 100;
            
            let congrats = percent === 100 ? "🏆 *PERFECT SCORE!* 🏆\nYou're a trivia genius! 🎓" :
                          percent >= 66 ? "🌟 *EXCELLENT!* 🌟\nYou really know your stuff! 📚" :
                          "👍 *GOOD JOB!* 👍\nPlay again to improve! 💪";
            
            const feedback = isCorrect ? `✅ Correct! The answer was: *${currentQ.a.toUpperCase()}*` : `❌ Wrong! The correct answer was: *${currentQ.a.toUpperCase()}*`;
            
            return {
                completed: true,
                message: `${feedback}\n━━━━━━━━━━━━━━━━\n\n${congrats}\n\n*Final Score:* ${newScore}/${questions.length}\n\n🎮 *Want to play again?* Say "trivia"!`
            };
        } else {
            const nextQ = questions[nextIndex];
            const feedback = isCorrect ? "✅ *CORRECT!* (+1 point) 🎉" : `❌ *WRONG!* The answer was: *${currentQ.a.toUpperCase()}*`;
            
            return {
                completed: false,
                nextStep: 'playing_trivia',
                message: `${feedback}\n━━━━━━━━━━━━━━━━\n\n*Question ${nextIndex+1}/${questions.length}:*\n${nextQ.q}\n\n*Options:*\n${nextQ.options.map((opt, i) => `${i+1}. ${opt}`).join('\n')}\n\n*Score:* ${newScore}/${nextIndex}\n\n💬 *Type your answer!* (or "quit trivia")`,
                collectedData: {
                    ...collectedData,
                    currentIndex: nextIndex,
                    score: newScore
                }
            };
        }
    }
}

export default FunChatWorkflow;