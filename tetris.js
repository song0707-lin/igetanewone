class Tetris {
    constructor() {
        // 建立20x10的遊戲板，初始值為0 (空)
        this.board = Array(20).fill().map(() => Array(10).fill(0));
        this.score = 0;
        this.level = 1;
        
        // DOM 元素
        this.gameBoard = document.querySelector('.game-board');
        this.currentPieceContainer = document.getElementById('current-piece');
        this.scoreElement = document.getElementById('score');
        this.levelElement = document.getElementById('level');
        this.pauseScreen = document.getElementById('pause-screen');
        
        // 建立固定的格子（用於顯示已鎖定的方塊）
        this.blocks = [];
        this.initBoardGrid();
        
        // 俄羅斯方塊基本形狀
        this.shapes = {
            I: [[1,1,1,1]],
            L: [[1,0],[1,0],[1,1]],
            J: [[0,1],[0,1],[1,1]],
            O: [[1,1],[1,1]],
            Z: [[1,1,0],[0,1,1]],
            S: [[0,1,1],[1,1,0]],
            T: [[1,1,1],[0,1,0]]
        };
        
        // 定義顏色（普通方塊以此設定）
        this.colors = {
            I: '#00f0f0',
            L: '#f0a000',
            J: '#0000f0',
            O: '#f0f000',
            Z: '#f00000',
            S: '#00f000',
            T: '#a000f0'
        };
        // 額外特殊方塊顏色
        this.frozenColor = '#add8e6'; // 冰凍方塊
        this.mysteryColor = 'purple'; // 隨機變化方塊
        
        // 遊戲狀態
        this.isPlaying = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.fallAccumulator = 0;
        this.fallInterval = 1; // 初始每格1秒 (隨等級加快)
        
        // 當前下落的方塊（物件包含：shape, type, color, interval[若為 mystery]）
        this.currentBlock = null;
        // 當前方塊在網格上的整數位置
        this.currentPos = { x: 0, y: 0 };
        
        // 特殊：凍結列，儲存物件 {row, until}，在 until 前該行無法消除
        this.frozenRows = [];
        
        // 綁定鍵盤事件
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }
    
    initBoardGrid() {
        // 清空 gameBoard 內原有格子
        this.gameBoard.innerHTML = '';
        // 建立 20x10 個 div，利用 grid 排版
        for (let i = 0; i < 20 * 10; i++) {
            const block = document.createElement('div');
            block.classList.add('block');
            this.gameBoard.appendChild(block);
            this.blocks.push(block);
        }
    }
    
    updateBoardDisplay() {
        // 更新固定板塊（已鎖定的方塊）
        for (let y = 0; y < 20; y++) {
            for (let x = 0; x < 10; x++) {
                const pos = y * 10 + x;
                if (this.board[y][x]) {
                    this.blocks[pos].style.backgroundColor = this.board[y][x];
                } else {
                    this.blocks[pos].style.backgroundColor = '#fff';
                }
            }
        }
    }
    
    updateCurrentPieceDisplay(offset) {
        // offset 為 0 ~ 1 之間的數字，代表從整格下落的進度
        this.currentPieceContainer.innerHTML = '';
        if (!this.currentBlock) return;
        const cellSize = 30; // 每格30px (300px/10)
        const effectiveY = this.currentPos.y + offset;
        for (let i = 0; i < this.currentBlock.shape.length; i++) {
            for (let j = 0; j < this.currentBlock.shape[i].length; j++) {
                if (this.currentBlock.shape[i][j]) {
                    const cell = document.createElement('div');
                    cell.style.position = 'absolute';
                    cell.style.width = cellSize + 'px';
                    cell.style.height = cellSize + 'px';
                    cell.style.backgroundColor = this.currentBlock.color;
                    cell.style.left = ((this.currentPos.x + j) * cellSize) + 'px';
                    cell.style.top = ((effectiveY + i) * cellSize) + 'px';
                    cell.style.border = '1px solid #999';
                    this.currentPieceContainer.appendChild(cell);
                }
            }
        }
    }
    
    // 生成新方塊，並隨機決定是否為特殊方塊
    generateNewPiece() {
        const shapeKeys = Object.keys(this.shapes);
        const randomKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
        const shape = this.shapes[randomKey];
        // 以 10% 機率為冰凍方塊，10% 為隨機變化方塊，其餘為普通方塊
        let rand = Math.random();
        let type = 'normal';
        let color = this.colors[randomKey];
        if (rand < 0.1) {
            type = 'frozen';
            color = this.frozenColor;
        } else if (rand < 0.2) {
            type = 'mystery';
            color = this.mysteryColor;
        }
        this.currentBlock = { shape, type, color };
        // 若為隨機變化方塊，啟動定時變形效果
        if (type === 'mystery') {
            this.currentBlock.interval = setInterval(() => {
                const newKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                this.currentBlock.shape = this.shapes[newKey];
                this.currentBlock.color = this.mysteryColor;
            }, 500);
        }
        // 將方塊置中生成於頂部
        this.currentPos = {
            x: Math.floor((10 - shape[0].length) / 2),
            y: 0
        };
        this.fallAccumulator = 0;
    }
    
    // 檢查新位置是否有效（只考慮整數位置，不含補間）
    canMove(newX, newY, piece = this.currentBlock.shape) {
        for (let i = 0; i < piece.length; i++) {
            for (let j = 0; j < piece[i].length; j++) {
                if (piece[i][j]) {
                    const x = newX + j;
                    const y = newY + i;
                    if (x < 0 || x >= 10 || y >= 20) return false;
                    if (y >= 0 && this.board[y][x]) return false;
                }
            }
        }
        return true;
    }
    
    // 將當前方塊鎖定到板上
    freezePiece() {
        const shape = this.currentBlock.shape;
        for (let i = 0; i < shape.length; i++) {
            for (let j = 0; j < shape[i].length; j++) {
                if (shape[i][j]) {
                    const x = this.currentPos.x + j;
                    const y = this.currentPos.y + i;
                    if (y >= 0 && y < 20 && x >= 0 && x < 10) {
                        this.board[y][x] = this.currentBlock.color;
                    }
                }
            }
        }
        // 處理特殊效果：若為冰凍方塊，將所涉及的行凍結5秒
        if (this.currentBlock.type === 'frozen') {
            for (let i = 0; i < shape.length; i++) {
                const rowIndex = this.currentPos.y + i;
                this.freezeRow(rowIndex);
            }
        }
        // 若為隨機變化方塊，停止變形並隨機轉成普通形狀
        if (this.currentBlock.type === 'mystery') {
            clearInterval(this.currentBlock.interval);
            const shapeKeys = Object.keys(this.shapes);
            const newKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
            this.currentBlock.shape = this.shapes[newKey];
            this.currentBlock.color = this.colors[newKey];
        }
        this.currentBlock = null;
    }
    
    // 將指定行凍結，5秒後解除
    freezeRow(rowIndex) {
        if (!this.frozenRows.some(r => r.row === rowIndex)) {
            this.frozenRows.push({ row: rowIndex, until: Date.now() + 5000 });
        }
    }
    
    updateFrozenRows() {
        const now = Date.now();
        this.frozenRows = this.frozenRows.filter(r => r.until > now);
    }
    
    // 若該行滿且未被凍結，則可被消除
    canClearRow(rowIndex) {
        this.updateFrozenRows();
        return !this.frozenRows.some(r => r.row === rowIndex);
    }
    
    // 檢查並清除滿行（考慮凍結行）
    checkLines() {
        let linesCleared = 0;
        for (let y = 19; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0) && this.canClearRow(y)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(10).fill(0));
                linesCleared++;
                y++; // 重新檢查同一行
            }
        }
        if (linesCleared > 0) {
            this.updateScore(linesCleared);
        }
    }
    
    updateScore(linesCleared) {
        const points = [0, 100, 300, 500, 800];
        this.score += points[linesCleared];
        this.level = Math.floor(this.score / 1000) + 1;
        this.scoreElement.textContent = this.score;
        this.levelElement.textContent = this.level;
        // 更新掉落速度（每格掉落時間最短0.1秒）
        this.fallInterval = Math.max(0.1, 1 - (this.level - 1) * 0.1);
    }
    
    gameOver() {
        this.isPlaying = false;
        cancelAnimationFrame(this.animationFrameId);
        alert(`遊戲結束！\n最終分數：${this.score}\n等級：${this.level}`);
    }
    
    // 鍵盤控制
    handleKeyPress(event) {
        if (!this.isPlaying || this.isPaused) return;
        switch(event.code) {
            case 'ArrowLeft':
                if (this.canMove(this.currentPos.x - 1, this.currentPos.y))
                    this.currentPos.x--;
                break;
            case 'ArrowRight':
                if (this.canMove(this.currentPos.x + 1, this.currentPos.y))
                    this.currentPos.x++;
                break;
            case 'ArrowDown':
                if (this.canMove(this.currentPos.x, this.currentPos.y + 1))
                    this.currentPos.y++;
                else {
                    this.freezePiece();
                    this.checkLines();
                    this.generateNewPiece();
                    if (!this.canMove(this.currentPos.x, this.currentPos.y)) {
                        this.gameOver();
                        return;
                    }
                }
                this.fallAccumulator = 0;
                break;
            case 'KeyZ':
                const rotated = this.currentBlock.shape[0].map((_, i) =>
                    this.currentBlock.shape.map(row => row[i]).reverse()
                );
                if (this.canMove(this.currentPos.x, this.currentPos.y, rotated)) {
                    this.currentBlock.shape = rotated;
                }
                break;
            case 'Space':
                // 快速下落，直接移至無法下移的位置
                while(this.canMove(this.currentPos.x, this.currentPos.y + 1)) {
                    this.currentPos.y++;
                    this.score += 1;
                }
                this.freezePiece();
                this.checkLines();
                this.generateNewPiece();
                if (!this.canMove(this.currentPos.x, this.currentPos.y)) {
                    this.gameOver();
                    return;
                }
                this.fallAccumulator = 0;
                break;
            case 'KeyP':
                if (this.isPaused) {
                    this.resume();
                } else {
                    this.pause();
                }
                return;
        }
        this.updateCurrentPieceDisplay(this.fallAccumulator / this.fallInterval);
    }
    
    // 遊戲主循環，利用 requestAnimationFrame 實現補間動畫
    gameLoop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const delta = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;
        if (!this.isPaused) {
            this.fallAccumulator += delta;
            if (this.fallAccumulator >= this.fallInterval) {
                if (this.canMove(this.currentPos.x, this.currentPos.y + 1)) {
                    this.currentPos.y++;
                    this.fallAccumulator -= this.fallInterval;
                } else {
                    this.freezePiece();
                    this.checkLines();
                    this.generateNewPiece();
                    if (!this.canMove(this.currentPos.x, this.currentPos.y)) {
                        this.gameOver();
                        return;
                    }
                    this.fallAccumulator = 0;
                }
            }
            this.updateBoardDisplay();
            this.updateCurrentPieceDisplay(this.fallAccumulator / this.fallInterval);
        }
        this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    start() {
        if (this.isPlaying) return;
        this.reset();
        this.isPlaying = true;
        this.isPaused = false;
        this.generateNewPiece();
        this.lastTime = 0;
        this.fallAccumulator = 0;
        document.addEventListener('keydown', this.handleKeyPress);
        this.animationFrameId = requestAnimationFrame((ts) => this.gameLoop(ts));
    }
    
    pause() {
        if (!this.isPaused) {
            this.isPaused = true;
            this.pauseScreen.style.display = 'flex';
        }
    }
    
    resume() {
        if (this.isPaused) {
            this.isPaused = false;
            this.pauseScreen.style.display = 'none';
        }
    }
    
    reset() {
        cancelAnimationFrame(this.animationFrameId);
        this.board = Array(20).fill().map(() => Array(10).fill(0));
        this.score = 0;
        this.level = 1;
        this.frozenRows = [];
        this.currentBlock = null;
        this.currentPos = { x: 0, y: 0 };
        this.fallAccumulator = 0;
        this.fallInterval = 1;
        this.updateBoardDisplay();
        this.scoreElement.textContent = '0';
        this.levelElement.textContent = '1';
        this.pauseScreen.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Tetris();
    
    document.getElementById('start-btn').addEventListener('click', () => {
        game.start();
    });
    
    document.getElementById('pause-btn').addEventListener('click', () => {
        if (game.isPaused) {
            game.resume();
        } else {
            game.pause();
        }
    });
    
    document.getElementById('reset-btn').addEventListener('click', () => {
        game.reset();
    });
});
