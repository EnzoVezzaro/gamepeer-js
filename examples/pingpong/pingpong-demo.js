// Ping Pong Game Demo using GamePeerJS
const GamePeerJS = window.GamePeerJS;

// Game constants
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 100;
const BALL_SIZE = 15;
const PADDLE_SPEED = 8;

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hostBtn = document.getElementById('hostBtn');
    const joinBtn = document.getElementById('joinBtn');
    const roomInput = document.getElementById('roomInput');
    const player1Score = document.getElementById('player1Score');
    const player2Score = document.getElementById('player2Score');

    // Game state
    let leftPaddleY = canvas.height / 2 - PADDLE_HEIGHT / 2;
    let rightPaddleY = canvas.height / 2 - PADDLE_HEIGHT / 2;
    let ballX = canvas.width / 2;
    let ballY = canvas.height / 2;
    let ballSpeedX = 5;
    let ballSpeedY = 5;
    let gameStarted = false;
    let isHost = false;
    let keyboard = null;
    let game = null;
    let matchmaking = null;
    let roomId = null;

    // Initialize game with matchmaking
    function initGame() {
        const playerId = `player-${Math.random().toString(36).substr(2, 4)}`;
        game = new GamePeerJS({
            debug: true,
            useMatchmaking: true,
            matchmakingOptions: {
                maxPlayers: 8,
                gameName: 'Untitled Game'
            },
            useKeyboardController: true,
            localPlayerId: playerId
        });
        // Handle game state updates
        game.on('stateUpdate', (data) => {
            if (data.ball) {
                ballX = data.ball.x;
                ballY = data.ball.y;
                ballSpeedX = data.ball.speedX;
                ballSpeedY = data.ball.speedY;
            }
            if (data.scores) {
                updateScoreDisplay();
            }
            if (data.paddles) {
                if (isHost) {
                    rightPaddleY = data.paddles.right;
                } else {
                    leftPaddleY = data.paddles.left;
                }
            }
        });

        // Handle player joined events
        game.on('playerJoined', (playerId) => {
            if (playerId !== game.localPlayerId && !gameStarted) {
                gameStarted = true;
                if (isHost) {
                    setInterval(gameLoop, 16);
                }
            }
        });
    }

    function initKeyboard() {
        try {
            keyboard = game.getKeyboardController();
            if (isHost) {
                // Host controls left paddle locally, receives right paddle updates
                keyboard.on('up', (data) => {
                    if (data && data.playerId === game.localPlayerId) {
                        leftPaddleY = Math.max(0, leftPaddleY - PADDLE_SPEED);
                    } else {
                        rightPaddleY = Math.max(0, rightPaddleY - PADDLE_SPEED);
                    }
                });
                keyboard.on('down', (data) => {
                    if (data && data.playerId === game.localPlayerId) {
                        leftPaddleY = Math.min(canvas.height - PADDLE_HEIGHT, leftPaddleY + PADDLE_SPEED);
                    } else {
                        rightPaddleY = Math.min(canvas.height - PADDLE_HEIGHT, rightPaddleY + PADDLE_SPEED);
                    }
                });
            } else {
                // Client controls right paddle locally, receives left paddle updates
                keyboard.on('up', (data) => {
                    if (data && data.playerId === game.localPlayerId) {
                        rightPaddleY = Math.max(0, rightPaddleY - PADDLE_SPEED);
                    } else {
                        leftPaddleY = Math.max(0, leftPaddleY - PADDLE_SPEED);
                    }
                });
                keyboard.on('down', (data) => {
                    if (data && data.playerId === game.localPlayerId) {
                        rightPaddleY = Math.min(canvas.height - PADDLE_HEIGHT, rightPaddleY + PADDLE_SPEED);
                    } else {
                        leftPaddleY = Math.min(canvas.height - PADDLE_HEIGHT, leftPaddleY + PADDLE_SPEED);
                    }
                });
            }
        } catch (err) {
            console.error('Keyboard init error:', err);
        }
    }

    function initMatch() {
        try {
            // Initialize matchmaking service
            matchmaking = game.getMatchmakingService();
            matchmaking.on('roomsUpdated', (data) => {
                updateScoreDisplay();
            })
            // Register room with initial scores
            // console.log('registering match with room: ', roomId);
            
            matchmaking.registerRoom(roomId);
        } catch (err) {
            console.error('Keyboard init error:', err);
        }
    }

    // Host game
    hostBtn.onclick = async () => {
        isHost = true;
        initGame();
        roomId = await game.hostGame();
        roomInput.value = roomId;
        roomInput.disabled = true;
        
        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.id = 'copyRoomBtn';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(roomId);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        };
        roomInput.parentNode.appendChild(copyBtn);

        // Initialize keyboard after room is ready
        initKeyboard();
        initMatch();
    };

    // Join game
    joinBtn.onclick = async () => {
        initGame();
        await game.joinGame(roomInput.value);
        gameStarted = true;
        setInterval(gameLoop, 16);
        
        // Initialize keyboard after joining
        initKeyboard();
        initMatch();
    };

    // Game loop
    // Game loop
function gameLoop() {
    if (!gameStarted) return;

    // Move ball
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Ball collision with top/bottom (Bounce)
    if (ballY <= 0 || ballY >= canvas.height - BALL_SIZE) {
        ballSpeedY = -ballSpeedY;
    }

    // Check for collisions with paddles
    let paddleCollision = false;
    
    // Ball collision with left paddle
    if (ballX <= PADDLE_WIDTH && 
        ballY + BALL_SIZE >= leftPaddleY && 
        ballY <= leftPaddleY + PADDLE_HEIGHT) {
        
        // Ball is just touching the left paddle, adjust position to avoid sticking
        ballX = PADDLE_WIDTH; // Keep ball from getting stuck
        ballSpeedX = Math.abs(ballSpeedX) * 1.1; // Ensure ball goes to the right
        paddleCollision = true;
        // console.log('Collision with left paddle:', ballX, ballY);
    }

    // Ball collision with right paddle
    if (ballX + BALL_SIZE >= canvas.width - PADDLE_WIDTH && 
        ballY + BALL_SIZE >= rightPaddleY && 
        ballY <= rightPaddleY + PADDLE_HEIGHT) {

        // Ball is just touching the right paddle, adjust position to avoid sticking
        ballX = canvas.width - PADDLE_WIDTH - BALL_SIZE; // Move ball just outside of the paddle
        ballSpeedX = -Math.abs(ballSpeedX) * 1.1; // Ensure ball bounces left
        paddleCollision = true;
        // console.log('Collision with right paddle:', ballX, ballY);
    }

    // Only check for scoring if no paddle collision occurred
    if (!paddleCollision) {
        // Ball crosses left boundary (completely missed the paddle)
        if (ballX < 0) {
            // Ball crossed left boundary (score for right player)
            matchmaking.updateScore(1, 1);
            resetBall();
            // console.log('Score for Player 2');
            updateScoreDisplay();
            return;
        }
        
        // Ball crosses right boundary (completely missed the paddle)
        if (ballX > canvas.width) {
            // Ball crossed right boundary (score for left player)
            matchmaking.updateScore(0, 1);
            resetBall();
            // console.log('Score for Player 1');
            updateScoreDisplay();
            return;
        }
    }

    // Sync game state
    if (isHost) {
        game.broadcastEvent('stateUpdate', {
            ball: { x: ballX, y: ballY, speedX: ballSpeedX, speedY: ballSpeedY },
            paddles: { left: leftPaddleY, right: rightPaddleY }
        });
    } else {
        game.broadcastEvent('stateUpdate', {
            paddles: { right: rightPaddleY }
        });
    }

    // Draw everything
    draw();
}

    function resetBall() {
        ballX = canvas.width / 2;
        ballY = canvas.height / 2;
        ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1);
        ballSpeedY = 5 * (Math.random() > 0.5 ? 1 : -1);
        updateScoreDisplay();
    }

    function updateScoreDisplay() {
        const scores = matchmaking.getScores();
        // console.log('getting score from service: ', scores);
        player1Score.textContent = scores[0];
        player2Score.textContent = scores[1];
    }

    function draw() {
        // Clear canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw paddles
        ctx.fillStyle = 'white';
        ctx.fillRect(0, leftPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);
        ctx.fillRect(canvas.width - PADDLE_WIDTH, rightPaddleY, PADDLE_WIDTH, PADDLE_HEIGHT);

        // Draw ball
        ctx.fillRect(ballX, ballY, BALL_SIZE, BALL_SIZE);

        // Draw center line
        ctx.strokeStyle = 'white';
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }
});
