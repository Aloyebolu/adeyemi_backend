// AbuseWorkflow.js
class AbuseWorkflow {
    constructor() {
        this.STRIKE_LIMIT = 3;
        
        // Random message banks for variety
        this.MESSAGE_BANKS = {
            // Warning messages (random selection)
            WARNINGS: [
                {
                    main: "⚠️ *STRIKE ${currentStrike}/${STRIKE_LIMIT}* ⚠️\n━━━━━━━━━━━━━━━━\n\n😔 *Aww, that wasn't very nice...*\n\nI'm here to help you learn and grow, friend! 🎓✨\n\n_${remainingStrikes} more strike(s) and you'll get an academic challenge._\n\nLet's keep it respectful, okay? 🙏💙",
                    footer: "😊 *Choose kindness today!*"
                },
                {
                    main: "😕 *Oh dear...*\n━━━━━━━━━━━━━━━━\n\nThat language isn't welcome in our learning space.\n\n*Strike ${currentStrike}/${STRIKE_LIMIT}*\n\n🤗 I know you can do better! Let's communicate positively.\n\n_${remainingStrikes} strike(s) left before a fun academic challenge._",
                    footer: "💪 *You've got this! Let's be awesome together.*"
                },
                {
                    main: "🙁 *That hurts my digital feelings...*\n━━━━━━━━━━━━━━━━\n\nBut I forgive you! 😇\n\n*Current strike:* ${currentStrike}/${STRIKE_LIMIT}\n\n💫 Remember: Every interaction is a chance to grow.\n\n_${remainingStrikes} more and we play an educational game!_",
                    footer: "🌈 *Be the reason someone smiles today!*"
                },
                {
                    main: "😬 *Yikes! That was harsh.*\n━━━━━━━━━━━━━━━━\n\nI'm still here for you though! 🤗\n\n*Strike ${currentStrike}/${STRIKE_LIMIT}*\n\n📚 Let's turn that frown upside down with positivity!\n\n_${remainingStrikes} strike(s) until academic challenge time._",
                    footer: "😄 *Smile! Education is fun!*"
                },
                {
                    main: "😳 *Whoa there, partner!*\n━━━━━━━━━━━━━━━━\n\nLet's take a breath and reset. 🧘\n\n*Strike ${currentStrike}/${STRIKE_LIMIT}*\n\n🤝 I'm on your side! Let's keep it respectful.\n\n_${remainingStrikes} more strikes = learning game!_",
                    footer: "🌟 *You're capable of amazing things. Let's be kind!*"
                }
            ],
            
            // Warning acknowledgment responses
            ACKNOWLEDGMENTS: [
                {
                    success: "🥹 *Aww, thank you for understanding!* 🥹\n━━━━━━━━━━━━━━━━\n\n😊 That means a lot to me!\n\n💙 Let's continue this beautiful journey together.\n\n*How can I help you today, wonderful student?* 🌟",
                    waiting: "😕 *I'm still waiting for your acknowledgment...*\n━━━━━━━━━━━━━━━━\n\n🤗 Just type *\"sorry\"* or *\"I understand\"* and we can move forward.\n\n💫 I believe in second chances! Let's do this together."
                },
                {
                    success: "🎉 *Yay! You made the right choice!* 🎉\n━━━━━━━━━━━━━━━━\n\n😁 See? Kindness wins every time!\n\n💪 Now let's get back to what matters - YOUR education!\n\n*What would you like to do?* 📚✨",
                    waiting: "🙏 *I'm still here, patiently waiting...*\n━━━━━━━━━━━━━━━━\n\n😇 Just say *\"I understand\"* or *\"sorry\"* and all is forgiven.\n\n🤝 Let's reset and start fresh, friend!"
                },
                {
                    success: "😭 *This makes me so happy!* 😭\n━━━━━━━━━━━━━━━━\n\n💖 You chose respect and growth!\n\n🎓 Now let's accomplish great things together!\n\n*How may I assist you?* 🌈",
                    waiting: "🧘 *I've got all the time in the world for you...*\n━━━━━━━━━━━━━━━━\n\n😊 Type *\"sorry\"* or *\"I understand\"* and we'll move forward.\n\n✨ Growth takes patience. I'm right here with you."
                }
            ],
            
            // Timeout messages
            TIMEOUTS: [
                {
                    active: "😴 *TIME OUT!* 😴\n━━━━━━━━━━━━━━━━\n\n${remaining} minute(s) remaining.\n\n🧘 Use this time to reflect, breathe, and center yourself.\n\n📖 *Fun fact:* Taking breaks actually improves learning!\n\n_You'll be automatically released. I'll be right here!_ 🤗",
                    expired: "🎉 *WELCOME BACK!* 🎉\n━━━━━━━━━━━━━━━━\n\n😊 Your timeout is complete!\n\n💫 Your strikes have been reset to ZERO.\n\n🌟 Let's start fresh with positivity and purpose!\n\n*How can I help you today, amazing student?* 🚀"
                },
                {
                    active: "⏰ *PAUSE BUTTON PRESSED* ⏰\n━━━━━━━━━━━━━━━━\n\n${remaining} minute(s) to go.\n\n😌 Take a deep breath... inhale... exhale...\n\n🎯 *Challenge:* Think of 3 things you're grateful for!\n\n_See you soon, friend!_ 💙",
                    expired: "🔊 *TIME'S UP!* 🔊\n━━━━━━━━━━━━━━━━\n\n😁 You've served your timeout with grace!\n\n✨ Your record is clean. Your strikes are gone.\n\n🎓 Ready to learn and grow together?\n\n*What's your next move?* 🚀"
                },
                {
                    active: "🧘 *REFLECTION MOMENT* 🧘\n━━━━━━━━━━━━━━━━\n\n${remaining} minute(s) left.\n\n😇 Remember: Every great person practices patience.\n\n💭 *Think about:* How can kindness change your day?\n\n_I'll be right here when you return!_ 🤗",
                    expired: "🌈 *FRESH START ACHIEVED!* 🌈\n━━━━━━━━━━━━━━━━\n\n😊 Your timeout has ended!\n\n💪 Your strikes have been COMPLETELY RESET.\n\n🌟 Let's make today amazing!\n\n*How can I brighten your day?* 💫"
                }
            ],
            
            // Challenge success messages
            CHALLENGE_SUCCESS: [
                {
                    message: "🎉 *YOU DID IT!* 🎉\n━━━━━━━━━━━━━━━━\n\n😍 ${explanation}\n\n🧠 You're not just good - you're BRILLIANT!\n\n✨ *All your strikes have been cleared!* ✨\n\n💫 Your record is spotless. Your future is bright.\n\n*What academic adventure awaits?* 🚀📚",
                    emoji: "🏆"
                },
                {
                    message: "🤯 *MIND = BLOWN!* 🤯\n━━━━━━━━━━━━━━━━\n\n${explanation}\n\n😎 You crushed that challenge like a boss!\n\n🌟 *STRIKES: ZERO* 🌟\n\n💪 Learning > Punishment. You proved it!\n\n*Ready to continue your journey?* 🎓✨",
                    emoji: "⭐"
                },
                {
                    message: "🎓 *ACADEMIC VICTORY!* 🎓\n━━━━━━━━━━━━━━━━\n\n${explanation}\n\n😁 I KNEW you could do it!\n\n🌈 *Your strikes have been completely reset!*\n\n📚 This is what growth looks like. Proud of you!\n\n*How shall we celebrate your comeback?* 🎉💙",
                    emoji: "💪"
                },
                {
                    message: "💡 *EUREKA!* 💡\n━━━━━━━━━━━━━━━━\n\n${explanation}\n\n😊 That's the smart student I know!\n\n✨ *Clean slate achieved!* ✨\n\n🎯 Your strikes are GONE. Your potential is LIMITLESS.\n\n*What's next on your learning journey?* 🌟📖",
                    emoji: "🧠"
                }
            ],
            
            // Challenge failure messages
            CHALLENGE_FAILURE: [
                {
                    message: "😢 *Aww, not quite right...* 😢\n━━━━━━━━━━━━━━━━\n\nBut that's okay! Learning takes practice.\n\n📚 *Let's try a different approach:*\n\nYou've earned a 10-minute timeout to reset.\n\n😌 Take a breath. I'll be here when you return!\n\n_Type anything after timeout to continue._ 💙",
                    timeout: true
                },
                {
                    message: "🤔 *Hmm, that's not the answer...* 🤔\n━━━━━━━━━━━━━━━━\n\n😇 No worries at all! Every mistake is a lesson.\n\n⏰ Taking a 10-minute break will help you reset.\n\n🧘 Use this time to clear your mind.\n\n_I believe in you! See you soon!_ 🌈",
                    timeout: true
                },
                {
                    message: "😅 *Oops! Wrong answer...* 😅\n━━━━━━━━━━━━━━━━\n\n💪 Don't give up! Sometimes we need a reset.\n\n⏰ 10-minute timeout activated.\n\n📖 *Suggestion:* Think about the question again.\n\n_You've got this! I'm rooting for you!_ 🎉",
                    timeout: true
                }
            ],
            
            // Give up messages
            GIVE_UP: [
                {
                    message: "😔 *You chose the timeout path...* 😔\n━━━━━━━━━━━━━━━━\n\nThat's okay! Sometimes we need a break.\n\n⏰ 10-minute timeout starting NOW.\n\n😌 Rest, relax, and come back refreshed.\n\n_I'll be right here waiting for you!_ 💙",
                    timeout: true
                },
                {
                    message: "🧘 *Taking the scenic route...* 🧘\n━━━━━━━━━━━━━━━━\n\nA 10-minute timeout it is!\n\n😊 Use this time to breathe and recenter.\n\n💭 *Remember:* Every champion takes breaks.\n\n_See you in 10 minutes, champ!_ 🌟",
                    timeout: true
                }
            ],
            
            // Academic challenges (multiple versions per game type)
            CHALLENGES: {
                MATH_CHALLENGE: {
                    names: ["🧮 *Math Magic* 🧮", "🔢 *Number Ninja* 🔢", "➕ *Calculation Station* ➖", "🧠 *Brain Math* 🧮"],
                    generate: () => {
                        const a = Math.floor(Math.random() * 50) + 1;
                        const b = Math.floor(Math.random() * 50) + 1;
                        const operations = [
                            { op: '+', symbol: '➕', name: 'addition' },
                            { op: '-', symbol: '➖', name: 'subtraction' },
                            { op: '*', symbol: '✖️', name: 'multiplication' }
                        ];
                        const opData = operations[Math.floor(Math.random() * operations.length)];
                        let answer;
                        let question;
                        
                        switch(opData.op) {
                            case '+': answer = a + b; question = `${a} ${opData.symbol} ${b}`; break;
                            case '-': answer = a - b; question = `${a} ${opData.symbol} ${b}`; break;
                            case '*': answer = a * b; question = `${a} ${opData.symbol} ${b}`; break;
                        }
                        
                        return { 
                            question, 
                            answer: answer.toString(), 
                            explanation: `✨ ${question} = ${answer}! You're a math wizard! 🧙‍♂️` 
                        };
                    }
                },
                SPELLING_BEE: {
                    names: ["📝 *Spelling Superstar* 📝", "🔤 *Word Wizard* 🔤", "✍️ *Spelling Champion* ✍️", "📖 *Vocabulary Victor* 📖"],
                    generate: () => {
                        const words = [
                            { word: "necessary", hint: "🧥 It's necessary to have one collar and two sleeves (one 'c', two 's's)" },
                            { word: "accommodate", hint: "🛏️ Double 'c', double 'm' - big enough to accommodate both!" },
                            { word: "separate", hint: "🐀 There's 'a rat' in separate!" },
                            { word: "definitely", hint: "🔚 Definitely has 'finite' in it!" },
                            { word: "maintenance", hint: "🔧 Maintenance has 'main' and 'tenance'" },
                            { word: "embarrass", hint: "😳 Really red cheeks - double 'r', double 's'!" }
                        ];
                        const selected = words[Math.floor(Math.random() * words.length)];
                        return { 
                            question: `Spell this word: *"${selected.word.toUpperCase()}"*`, 
                            answer: selected.word.toLowerCase(),
                            hint: `💡 *Hint:* ${selected.hint}`,
                            explanation: `🎉 Perfect! "${selected.word}" is spelled ${selected.word.split('').join('-')}. Spelling bee champion! 🐝`
                        };
                    }
                },
                TRIVIA: {
                    names: ["🎓 *Trivia Titan* 🎓", "🧠 *Knowledge Knight* 🧠", "📚 *Fact Finder* 📚", "💡 *Brainiac Bonus* 💡"],
                    generate: () => {
                        const trivia = [
                            { q: "What is the powerhouse of the cell? 🦠", a: "mitochondria", exp: "🔋 Mitochondria generate 90% of the cell's energy! Power up!" },
                            { q: "Who developed the theory of relativity? ⚛️", a: "einstein", exp: "🧠 Albert Einstein revolutionized physics in 1905! E=mc²!" },
                            { q: "What is the hardest natural substance? 💎", a: "diamond", exp: "✨ Diamonds score 10 on the Mohs hardness scale! Indestructible!" },
                            { q: "What year did World War II end? 🌍", a: "1945", exp: "🕊️ WWII ended in 1945. Peace prevailed!" },
                            { q: "Who painted the Mona Lisa? 🎨", a: "da vinci", exp: "🖌️ Leonardo da Vinci painted her smiling mysteriously!" },
                            { q: "What's the largest ocean on Earth? 🌊", a: "pacific", exp: "🌏 The Pacific covers 30% of Earth's surface! So big!" }
                        ];
                        const selected = trivia[Math.floor(Math.random() * trivia.length)];
                        return {
                            question: selected.q,
                            answer: selected.a.toLowerCase(),
                            explanation: selected.exp
                        };
                    }
                }
            }
        };
        
        // Random message selector helper
        this.random = (array) => array[Math.floor(Math.random() * array.length)];
        this.interpolate = (template, variables) => {
            return template.replace(/\${(\w+)}/g, (match, key) => variables[key] || match);
        };
    }

    async execute(context) {
        const { conversationState, userContext, originalMessage } = context;
        
        if (!conversationState.abuseTracking) {
            conversationState.abuseTracking = {
                strikes: 0,
                currentPunishment: null,
                punishmentEndTime: null,
                isPermanentlyLocked: false,
                currentChallenge: null,
                challengeAttempts: 0,
                challengeType: null
            };
        }
        
        const tracking = conversationState.abuseTracking;
        
        // Check if permanently locked
        if (tracking.isPermanentlyLocked) {
            const remaining = Math.ceil((tracking.punishmentEndTime - Date.now()) / (60 * 60 * 1000));
            const lockMessages = [
                `🔒 *ACCOUNT ON COOLDOWN* 🔒\n━━━━━━━━━━━━━━━━\n\n😔 I can't help you right now...\n\n⏰ *Time remaining:* ${remaining} hour(s)\n\n😌 Use this time to reflect and reset.\n\n💙 *I'll be here when you return!*\n\n_Contact support for questions._ 📧`,
                `😴 *REST MODE ACTIVATED* 😴\n━━━━━━━━━━━━━━━━\n\nYour account needs a break.\n\n🕐 *${remaining} hour(s) remaining*\n\n🧘 Take this time to breathe and center yourself.\n\n🌟 *See you soon, friend!*`,
                `🌙 *GOOD NIGHT, STUDENT* 🌙\n━━━━━━━━━━━━━━━━\n\nNot literally night, but you need rest!\n\n⏰ ${remaining} hour(s) until access restored.\n\n💭 *Remember:* Every great comeback starts with a pause.\n\n_I believe in you!_ 💪`
            ];
            return {
                requiresMoreInfo: true,
                nextStep: 'permanently_locked',
                prompt: this.random(lockMessages),
                collectedData: { punishmentType: 'permanent_lock' }
            };
        }
        
        // Check if in punishment
        if (tracking.punishmentEndTime && Date.now() < tracking.punishmentEndTime) {
            if (tracking.currentPunishment === 'timeout') {
                const remaining = Math.ceil((tracking.punishmentEndTime - Date.now()) / 60000);
                const timeoutMsg = this.random(this.MESSAGE_BANKS.TIMEOUTS);
                return {
                    requiresMoreInfo: true,
                    nextStep: 'timeout',
                    prompt: this.interpolate(timeoutMsg.active, { remaining }),
                    collectedData: { punishmentType: 'timeout', endTime: tracking.punishmentEndTime }
                };
            } else if (tracking.currentPunishment === 'challenge') {
                return {
                    requiresMoreInfo: true,
                    nextStep: 'academic_challenge',
                    prompt: this.getChallengePrompt(tracking),
                    collectedData: { 
                        punishmentType: 'challenge',
                        currentChallenge: tracking.currentChallenge,
                        attempts: tracking.challengeAttempts
                    }
                };
            }
        } else if (tracking.punishmentEndTime) {
            tracking.punishmentEndTime = null;
            tracking.currentPunishment = null;
            tracking.currentChallenge = null;
            tracking.challengeAttempts = 0;
            tracking.strikes = 0;
            conversationState.activeWorkflow = null;
        }
        
        // Check if message is abusive
        const isAbusive = this.isAbusiveMessage(originalMessage);
        
        if (!isAbusive) {
            return null;
        }
        
        // Increment strikes
        tracking.strikes++;
        
        // Determine action
        if (tracking.strikes >= 6) {
            return this.applyPermanentLock(context, tracking);
        } else if (tracking.strikes >= this.STRIKE_LIMIT) {
            return this.applyAcademicChallenge(context, tracking);
        } else {
            return this.giveWarning(tracking);
        }
    }
    
    isAbusiveMessage(message) {
        const lowerMsg = message.toLowerCase();
        const abusePatterns = [
            /stupid/i, /idiot/i, /dumb/i, /useless/i, /hate/i, /suck/i,
            /worthless/i, /trash/i, /terrible/i, /annoying/i, /frustrating/i,
            /fuck/i, /shit/i, /damn/i, /hell/i, /crap/i, /moron/i,
            /incompetent/i, /pathetic/i, /horrible/i, /awful/i, /disgusting/i,
            /fool/i, /jerk/i, /bastard/i, /screw you/i, /shut up/i,
            /kill/i, /die/i, /hate you/i, /worst/i, /mad/i, /crazy/i,
            /stupid bot/i, /useless bot/i, /trash bot/i
        ];
        
        for (const pattern of abusePatterns) {
            if (pattern.test(lowerMsg)) {
                return true;
            }
        }
        return false;
    }
    
    giveWarning(tracking) {
        const currentStrike = tracking.strikes;
        const remainingStrikes = this.STRIKE_LIMIT - currentStrike;
        
        const warning = this.random(this.MESSAGE_BANKS.WARNINGS);
        const message = this.interpolate(warning.main, { currentStrike, remainingStrikes, STRIKE_LIMIT: this.STRIKE_LIMIT });
        const fullMessage = `${message}\n\n${warning.footer}`;
        
        return {
            requiresMoreInfo: true,
            nextStep: 'warning_acknowledged',
            prompt: fullMessage,
            collectedData: { strikes: tracking.strikes }
        };
    }
    
    applyAcademicChallenge(context, tracking) {
        // Randomly select a challenge type
        const gameTypes = ['MATH_CHALLENGE', 'SPELLING_BEE', 'TRIVIA'];
        const selectedType = this.random(gameTypes);
        const challengeBank = this.MESSAGE_BANKS.CHALLENGES[selectedType];
        const gameName = this.random(challengeBank.names);
        const challenge = challengeBank.generate();
        
        tracking.currentPunishment = 'challenge';
        tracking.currentChallenge = {
            type: selectedType,
            gameName: gameName,
            question: challenge.question,
            answer: challenge.answer,
            explanation: challenge.explanation,
            hint: challenge.hint || null
        };
        tracking.challengeAttempts = 0;
        tracking.punishmentEndTime = null;
        
        if (context.services?.analyticsService) {
            context.services.analyticsService.logInteraction({
                userId: context.userContext.studentId,
                intent: 'ABUSE_CHALLENGE',
                timestamp: new Date(),
                strikes: tracking.strikes,
                challengeType: selectedType
            });
        }
        
        return {
            requiresMoreInfo: true,
            nextStep: 'academic_challenge',
            prompt: this.getChallengePrompt(tracking),
            collectedData: { 
                punishmentType: 'challenge',
                currentChallenge: tracking.currentChallenge,
                attempts: 0
            }
        };
    }
    
    getChallengePrompt(tracking) {
        const challenge = tracking.currentChallenge;
        const attemptsLeft = 3 - tracking.challengeAttempts;
        
        const introMessages = [
            `📚 *ACADEMIC REHABILITATION* 📚\n━━━━━━━━━━━━━━━━\n\n😅 *Uh oh! Someone earned a learning moment!*\n\n${challenge.gameName}\n\n🎯 *Challenge:* ${challenge.question}\n\n💭 *Type your answer below.*\n\n📝 *Attempts left:* ${attemptsLeft}\n\n✨ *Answer correctly = strikes reset to ZERO!*\n\n_Type "give up" for a 10-minute timeout instead._ 💙`,
            `🎓 *LEARNING THROUGH PLAY* 🎓\n━━━━━━━━━━━━━━━━\n\n😊 Instead of punishment, let's LEARN!\n\n${challenge.gameName}\n\n❓ ${challenge.question}\n\n💪 *You've got ${attemptsLeft} attempt(s) left!*\n\n🌟 *Get it right and ALL strikes disappear!*\n\n_Or type "give up" for a break._ 🧘`,
            `🧠 *BRAIN BOOST CHALLENGE* 🧠\n━━━━━━━━━━━━━━━━\n\n😇 Let's turn this moment into GROWTH!\n\n${challenge.gameName}\n\n📖 ${challenge.question}\n\n🎯 *Attempts remaining:* ${attemptsLeft}\n\n💫 *Success = Clean slate!*\n\n_Type "give up" to take a timeout._ ⏰`
        ];
        
        let prompt = this.random(introMessages);
        
        if (challenge.hint) {
            prompt += `\n\n${challenge.hint}`;
        }
        
        return prompt;
    }
    
    applyPermanentLock(context, tracking) {
        tracking.isPermanentlyLocked = true;
        tracking.punishmentEndTime = Date.now() + (24 * 60 * 60 * 1000);
        
        const lockMessages = [
            `😔 *TEMPORARY GOODBYE* 😔\n━━━━━━━━━━━━━━━━\n\nYou've earned a 24-hour reset period.\n\n⏰ *Available again:* ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString()}\n\n😌 Use this time to reflect and recharge.\n\n💙 *I'll miss you! Come back better.* 🌈`,
            `🌙 *SEE YOU TOMORROW* 🌙\n━━━━━━━━━━━━━━━━\n\n24-hour cooldown activated.\n\n🧘 This is your chance to reset and grow.\n\n🌟 *When you return, we start fresh!*\n\n_I believe in your comeback!_ 💪`,
            `💫 *PAUSE. BREATHE. RESET.* 💫\n━━━━━━━━━━━━━━━━\n\n24 hours of reflection time.\n\n📅 *Return on:* ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString()}\n\n😊 Take this time to think about kindness.\n\n_See you tomorrow, friend!_ 🎉`
        ];
        
        if (context.services?.analyticsService) {
            context.services.analyticsService.logInteraction({
                userId: context.userContext.studentId,
                intent: 'ABUSE_TEMPORARY_LOCK',
                timestamp: new Date(),
                strikes: tracking.strikes
            });
        }
        
        return {
            requiresMoreInfo: true,
            nextStep: 'permanently_locked',
            prompt: this.random(lockMessages),
            collectedData: { punishmentType: 'temporary_lock' }
        };
    }
    
    applyTimeout(tracking) {
        tracking.currentPunishment = 'timeout';
        tracking.punishmentEndTime = Date.now() + (10 * 60 * 1000);
        
        const timeoutMessages = [
            `⏰ *10-MINUTE TIMEOUT* ⏰\n━━━━━━━━━━━━━━━━\n\n😌 Take a deep breath...\n\n🧘 Use these 10 minutes to reset and reflect.\n\n💭 *Think about:* How can kindness change your day?\n\n_I'll be right here when you return!_ 🤗💙`,
            `🧘 *REFLECTION BREAK* 🧘\n━━━━━━━━━━━━━━━━\n\n10 minutes. That's all you need.\n\n😊 Close your eyes. Breathe. Reset.\n\n🌟 *Remember:* Every master was once a beginner.\n\n_See you soon, champion!_ 🎉`,
            `😇 *TIME TO RESET* 😇\n━━━━━━━━━━━━━━━━\n\n10-minute cooldown activated.\n\n📖 *Challenge:* Name 3 things you're grateful for!\n\n💪 You've got this. I believe in you.\n\n_Type anything after timeout to continue._ 💙`
        ];
        
        return {
            requiresMoreInfo: true,
            nextStep: 'timeout',
            prompt: this.random(timeoutMessages),
            collectedData: { punishmentType: 'timeout', duration: 10 }
        };
    }
    
    async processStep(context) {
        const { step, userResponse, collectedData, conversationState, userContext, services } = context;
        
        switch(step) {
            case 'warning_acknowledged':
                return this.processWarningAcknowledgment(userResponse, conversationState);
            case 'timeout':
                return this.processTimeout(userResponse, conversationState);
            case 'academic_challenge':
                return await this.processAcademicChallenge(userResponse, collectedData, conversationState, userContext, services);
            case 'permanently_locked':
                return this.processPermanentLock(userResponse, conversationState);
            default:
                return {
                    completed: true,
                    message: "😅 *Oops! Something went wrong...*\n━━━━━━━━━━━━━━━━\n\nPlease type *HELP* to start over! 🙏"
                };
        }
    }
    
    processWarningAcknowledgment(userResponse, conversationState) {
        const acknowledgment = userResponse.toLowerCase().trim();
        const ackData = this.random(this.MESSAGE_BANKS.ACKNOWLEDGMENTS);
        
        if (['i understand', 'understand', 'ok', 'okay', 'sorry', 'my bad', 'apologies'].includes(acknowledgment)) {
            conversationState.activeWorkflow = null;
            return {
                completed: true,
                message: ackData.success
            };
        } else {
            return {
                completed: false,
                nextStep: 'warning_acknowledged',
                message: ackData.waiting,
                collectedData: {}
            };
        }
    }
    
    processTimeout(userResponse, conversationState) {
        const tracking = conversationState.abuseTracking;
        
        if (tracking.punishmentEndTime && Date.now() >= tracking.punishmentEndTime) {
            const timeoutExpired = this.random(this.MESSAGE_BANKS.TIMEOUTS);
            tracking.punishmentEndTime = null;
            tracking.currentPunishment = null;
            tracking.strikes = 0;
            conversationState.activeWorkflow = null;
            
            return {
                completed: true,
                message: timeoutExpired.expired
            };
        }
        
        const remaining = Math.ceil((tracking.punishmentEndTime - Date.now()) / 60000);
        const timeoutActive = this.random(this.MESSAGE_BANKS.TIMEOUTS);
        
        return {
            completed: false,
            nextStep: 'timeout',
            message: this.interpolate(timeoutActive.active, { remaining }),
            collectedData: {}
        };
    }
    
    async processAcademicChallenge(userResponse, collectedData, conversationState, userContext, services) {
        const tracking = conversationState.abuseTracking;
        const challenge = tracking.currentChallenge;
        const userAnswer = userResponse.toLowerCase().trim();
        
        // Handle give up
        if (userAnswer === 'give up') {
            const giveUpMsg = this.random(this.MESSAGE_BANKS.GIVE_UP);
            return this.applyTimeout(tracking);
        }
        
        // Check answer
        const isCorrect = userAnswer === challenge.answer || 
                         challenge.answer.includes(userAnswer) || 
                         userAnswer.includes(challenge.answer);
        
        if (isCorrect) {
            const successMsg = this.random(this.MESSAGE_BANKS.CHALLENGE_SUCCESS);
            const explanation = challenge.explanation || "🎉 Great job! You're a genius! 🧠";
            
            tracking.strikes = 0;
            tracking.currentPunishment = null;
            tracking.currentChallenge = null;
            tracking.challengeAttempts = 0;
            tracking.punishmentEndTime = null;
            conversationState.activeWorkflow = null;
            
            if (services?.analyticsService) {
                services.analyticsService.logInteraction({
                    userId: userContext.studentId,
                    intent: 'ABUSE_CHALLENGE_PASSED',
                    timestamp: new Date(),
                    challengeType: challenge.type
                });
            }
            
            return {
                completed: true,
                message: this.interpolate(successMsg.message, { explanation })
            };
        } else {
            tracking.challengeAttempts++;
            const attemptsLeft = 3 - tracking.challengeAttempts;
            
            if (attemptsLeft <= 0) {
                const failMsg = this.random(this.MESSAGE_BANKS.CHALLENGE_FAILURE);
                return this.applyTimeout(tracking);
            }
            
            const failResponses = [
                `❌ *Not quite right...* ❌\n━━━━━━━━━━━━━━━━\n\n😅 That's okay! Learning takes practice!\n\n📖 *Question:* ${challenge.question}\n\n📝 *Attempts left:* ${attemptsLeft}\n\n💪 You've got this! Try again!\n\n_Or type "give up" for a timeout._ 💙`,
                `🤔 *Hmm, that's not it...* 🤔\n━━━━━━━━━━━━━━━━\n\n😊 No worries! Every mistake is a lesson.\n\n🎯 ${challenge.question}\n\n✨ *${attemptsLeft} attempt(s) remaining!*\n\n🌟 Keep going! I believe in you!\n\n_Tip: Type "give up" to take a break._ 🧘`,
                `😅 *Oops! Wrong answer...* 😅\n━━━━━━━━━━━━━━━━\n\n📚 Let's try again!\n\n❓ ${challenge.question}\n\n🎯 *Attempts left:* ${attemptsLeft}\n\n💪 Don't give up! You're closer than you think!\n\n_Type "give up" for a timeout instead._ 💫`
            ];
            
            return {
                completed: false,
                nextStep: 'academic_challenge',
                message: this.random(failResponses),
                collectedData: { ...collectedData, attempts: tracking.challengeAttempts }
            };
        }
    }
    
    processPermanentLock(userResponse, conversationState) {
        const tracking = conversationState.abuseTracking;
        
        if (tracking.punishmentEndTime && Date.now() >= tracking.punishmentEndTime) {
            const unlockMessages = [
                `🔓 *WELCOME BACK!* 🔓\n━━━━━━━━━━━━━━━━\n\n😊 Your 24-hour break is complete!\n\n✨ Your account has been FULLY RESTORED.\n\n🌟 Your strikes are ZERO. Your record is CLEAN.\n\n💙 *Let's make today amazing together!*\n\nHow can I help you? 🚀`,
                `🌈 *FRESH START ACHIEVED!* 🌈\n━━━━━━━━━━━━━━━━\n\n🎉 You're back! And better than ever!\n\n💪 Your strikes have been COMPLETELY RESET.\n\n📚 Ready to learn and grow?\n\n*What's your first request?* 😊`,
                `🌟 *RETURN OF THE CHAMPION!* 🌟\n━━━━━━━━━━━━━━━━\n\n😁 Look who's back!\n\n✨ Your cooldown is over. Clean slate activated!\n\n💫 Let's write a beautiful story together.\n\n*How may I brighten your day?* 💙`
            ];
            
            tracking.isPermanentlyLocked = false;
            tracking.punishmentEndTime = null;
            tracking.strikes = 0;
            conversationState.activeWorkflow = null;
            
            return {
                completed: true,
                message: this.random(unlockMessages)
            };
        }
        
        const remaining = Math.ceil((tracking.punishmentEndTime - Date.now()) / (60 * 60 * 1000));
        const stillLockedMessages = [
            `🔒 *STILL ON COOLDOWN* 🔒\n━━━━━━━━━━━━━━━━\n\n😴 ${remaining} hour(s) remaining.\n\n😌 Patience is a virtue, my friend.\n\n💭 *Use this time wisely:* Read a book, take a walk, breathe.\n\n_I'll be right here when you return!_ 💙`,
            `⏳ *WAITING PERIOD CONTINUES* ⏳\n━━━━━━━━━━━━━━━━\n\n🕐 ${remaining} hour(s) left.\n\n🧘 Great things come to those who wait.\n\n🌟 *See you soon!*`,
            `🌙 *STILL RESTING* 🌙\n━━━━━━━━━━━━━━━━\n\n⏰ ${remaining} hour(s) until access restored.\n\n💪 Use this time to grow stronger.\n\n_Almost there!_ 🎉`
        ];
        
        return {
            completed: false,
            nextStep: 'permanently_locked',
            message: this.random(stillLockedMessages),
            collectedData: {}
        };
    }
}

export default AbuseWorkflow;