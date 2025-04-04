class Tetris {
    constructor() {
        // 初始化遊戲板：20行10列，0 表示空格
        this.board = Array(20).fill().map(() => Array(10).fill(0));
        this.score = 0;
        this.level = 1;
        
        // 取得 DOM 元素
        this.gameBoard = document.querySelector('.game-board');
        this.currentPieceContainer = document.getElementById('current-piece');
        this.scoreElement = document.getElementById('score');
        this.levelElement = document.getElementById('level');
        this.pauseScreen = document.getElementById('pause-screen');
        
        // 儲存遊戲板上每個格子，透過 grid 自動排版
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
        
        // 普通方塊的顏色
        this.colors = {
            I: '#00f0f0',
            L: '#f0a000',
            J: '#0000f0',
            O: '#f0f000',
            Z: '#f00000',
            S: '#00f000',
            T: '#a000f0'
        };
        // 特殊方塊的顏色
        this.frozenColor = '#add8e6';    // 冰凍方塊
        this.mysteryColor = 'purple';     // 隨機變化方塊
        
        // 遊戲狀態控制
        this.isPlaying = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.fallAccumulator = 0;
        this.fallInterval = 1; // 初始掉落速度：1秒掉落1格
        
        // 當前下落方塊物件：包含 shape、type 與 color
        // type 可為 'normal'、'frozen' 或 'mystery'
        this.currentBlock = null;
        // 當前方塊在網格上的整數位置
        this.currentPos = { x: 0, y: 0 };
        
        // 用來記錄凍結行（特殊：冰凍方塊落地後會凍結該行5秒，凍結期間該行不可被消除）
        // 結構：[{ row: 行號, until: 解凍時間戳 }]
        this.frozenRows = [];
        
        // 綁定鍵盤事件
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }
    
    initBoardGrid() {
        // 清空遊戲區內容，並建立 20 x 10 個格子
        this.gameBoard.innerHTML = '';
        this.blocks = [];
        for (let i = 0; i < 20 * 10; i++) {
            const block = document.createElement('div');
            block.classList.add('block');
            this.gameBoard.appendChild(block);
            this.blocks.push(block);
        }
    }
    
    updateBoardDisplay() {
        // 根據 board 陣列內容，更新每個固定格子的顏色
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
        // offset: 0~1 的補間數值，代表下落進度
        this.currentPieceContainer.innerHTML = '';
        if (!this.currentBlock) return;
        const cellSize = 30; // 每格尺寸：300px/10
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
    
    // 產生新方塊：隨機決定普通或特殊（各自 10% 機率出現）
    generateNewPiece() {
        const shapeKeys = Object.keys(this.shapes);
        const randomKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
        const shape = this.shapes[randomKey];
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
        // 若為隨機變化方塊，啟動定時變形效果，每500ms隨機改變形狀
        if (type === 'mystery') {
            this.currentBlock.interval = setInterval(() => {
                const newKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
                this.currentBlock.shape = this.shapes[newKey];
                this.currentBlock.color = this.mysteryColor;
            }, 500);
        }
        // 將新方塊置於頂部中間
        this.currentPos = {
            x: Math.floor((10 - shape[0].length) / 2),
            y: 0
        };
        this.fallAccumulator = 0;
    }
    
    // 檢查指定位置是否可以移動，參數 newX, newY 為整數位置，piece 為欲檢查的形狀
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
    
    // 將當前方塊鎖定到 board 上
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
        // 特殊效果處理
        if (this.currentBlock.type === 'frozen') {
            // 冰凍方塊：將方塊所在的每一行凍結 5 秒
            for (let i = 0; i < shape.length; i++) {
                const rowIndex = this.currentPos.y + i;
                this.freezeRow(rowIndex);
            }
        }
        if (this.currentBlock.type === 'mystery') {
            // 隨機變化方塊：停止變形定時器，落地後轉成普通方塊
            clearInterval(this.currentBlock.interval);
            const shapeKeys = Object.keys(this.shapes);
            const newKey = shapeKeys[Math.floor(Math.random() * shapeKeys.length)];
            this.currentBlock.shape = this.shapes[newKey];
            this.currentBlock.color = this.colors[newKey];
        }
        this.currentBlock = null;
    }
    
    // 將指定行凍結，5秒後解除（避免該行被消除）
    freezeRow(rowIndex) {
        if (!this.frozenRows.some(r => r.row === rowIndex)) {
            this.frozenRows.push({ row: rowIndex, until: Date.now() + 5000 });
        }
    }
    
    updateFrozenRows() {
        const now = Date.now();
        this.frozenRows = this.frozenRows.filter(r => r.until > now);
    }
    
    // 若該行已滿且未被凍結，則可消除該行
    canClearRow(rowIndex) {
        this.updateFrozenRows();
        return !this.frozenRows.some(r => r.row === rowIndex);
    }
    
    // 檢查 board 中滿行，並消除（跳過凍結中的行）
    checkLines() {
        let linesCleared = 0;
        for (let y = 19; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0) && this.canClearRow(y)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(10).fill(0));
                linesCleared++;
                y++; // 重新檢查新補上的該行
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
        // 更新掉落速度：最低每格 0.1 秒
        this.fallInterval = Math.max(0.1, 1 - (this.level - 1) * 0.1);
    }
    
    gameOver() {
        this.isPlaying = false;
        cancelAnimationFrame(this.animationFrameId);
        alert(`遊戲結束！\n最終分數：${this.score}\n等級：${this.level}`);
    }
    
    // 處理鍵盤事件：左右移動、下落、旋轉、快速落下、暫停
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
                // 矩陣旋轉：轉置並反轉每一行
                const rotated = this.currentBlock.shape[0].map((_, i) =>
                    this.currentBlock.shape.map(row => row[i]).reverse()
                );
                if (this.canMove(this.currentPos.x, this.currentPos.y, rotated))
                    this.currentBlock.shape = rotated;
                break;
            case 'Space':
                // 快速落下：直接移至無法下移的位置
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
        // 更新補間動畫顯示
        this.updateCurrentPieceDisplay(this.fallAccumulator / this.fallInterval);
    }
    
    // 遊戲主循環：利用 requestAnimationFrame 與補間動畫實現平滑下落
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
