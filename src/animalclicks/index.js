class AnimalClicks {
    static instance = null;

    constructor(innerText = ['🦝'],
                time = 2000,
                quality = 1,
                angle = 0,
                velocityX = 0,
                velocityY = 0,
                gravity = 0.075,
                dx = 10,
                dy = 10,
                effects = { random: true, physics: true, fade: true, hideCursor: true },
                fontSize = '24px') {
        if (AnimalClicks.instance) {
            AnimalClicks.instance.update({
                innerText,
                time,
                quality,
                angle,
                velocityX,
                velocityY,
                gravity,
                dx,
                dy,
                effects,
                fontSize
            });

            return AnimalClicks.instance;
        }

        this.innerText = innerText;
        this.time = time;
        this.quality = quality;
        this.angle = angle;
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.gravity = gravity;
        this.effects = effects;
        this.fontSize = fontSize;
        this.dx = dx;
        this.dy = dy;
        this.currentIndex = 0;

        this.handleClick = this.handleClick.bind(this);
        document.addEventListener('click', this.handleClick);

        this.mouseMoveHandler = this.mouseMoveHandler.bind(this);
        document.addEventListener('mousemove', this.mouseMoveHandler);

        this.textElement = this.createTextElement(0, 0);
        document.body.appendChild(this.textElement);
        this.injectStyles();

        if (this.effects.hideCursor) {
            this.hideCursor();
            this.textElement.classList.add('visible');
        }

        AnimalClicks.instance = this;
    }
    
    update(newProps) {
        Object.keys(newProps).forEach(key => {
            if (this[key] !== undefined) {
                this[key] = newProps[key];
            }
        });
        
        if (this.textElement) {
            this.textElement.remove();
            this.textElement = this.createTextElement(0, 0);
            document.body.appendChild(this.textElement);
            this.showCursor();
            if (this.effects.hideCursor) {
                this.hideCursor();
                this.textElement.classList.add('visible');
            }
        }
    }

    hideCursor() {document.body.classList.add('hide-cursor');}
    showCursor() {document.body.classList.remove('hide-cursor');}

    injectStyles() {
        if (!document.getElementById('animal-clicks-styles')) {
            const style = document.createElement('style');
            style.id = 'animal-clicks-styles';
            style.innerHTML = `
                .dropping-text {
                    position: absolute;
                    opacity: 0;
                    transition: opacity 0.5s ease-out;
                    will-change: transform;
                    user-select: none;
                    pointer-events: none;
                    z-index: 1000;
                }

                .dropping-text.visible {
                    opacity: 1;
                }

                .hide-cursor {
                    cursor: none !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    mouseMoveHandler(event) {
        const mouseX = event.clientX + window.scrollX - this.dx;
        const mouseY = event.clientY + window.scrollY - this.dy;
        
        if (this.textElement) {
            this.textElement.style.left = `${mouseX}px`;
            this.textElement.style.top = `${mouseY}px`;
        }
    }    

    createTextElement(x, y) {
        let textToDisplay;

        if (this.effects.random) {
            const randomIndex = Math.floor(Math.random() * this.innerText.length);
            textToDisplay = this.innerText[randomIndex];
        } else {
            textToDisplay = this.innerText[this.currentIndex];
            this.currentIndex = (this.currentIndex + 1) % this.innerText.length;
        }
        
        const textElement = document.createElement('span');
        textElement.className = 'dropping-text';
        textElement.innerText = textToDisplay;

        textElement.style.left = `${x}px`;
        textElement.style.top = `${y}px`;
        textElement.style.fontSize = this.fontSize;
        
        return textElement;
    }

    handleClick(event) {
        const adjustedX = event.clientX + window.scrollX - this.dx;
        const adjustedY = event.clientY + window.scrollY - this.dy;

        this.textElement.remove();
        this.textElement = this.createTextElement(adjustedX, adjustedY);
        document.body.appendChild(this.textElement);

        if (this.effects.hideCursor) {
            this.hideCursor();
            this.textElement.classList.add('visible');
        }

        for (let i = 0; i < this.quality; i++) {
            const textElement = this.textElement.cloneNode(true);
            document.body.appendChild(textElement);
            const randomRotation = Math.random() * this.angle;
            textElement.style.transform = `rotate(${randomRotation}deg)`;
            
            if (this.effects.fade) {
                setTimeout(() => {
                    textElement.classList.add('visible');
                }, 0);
        
                setTimeout(() => {
                    textElement.remove();
                }, this.time);
            }
        
            if (this.effects.physics) {
                this.applyPhysics(textElement);
            }
        }
    }    

    applyPhysics(textElement) {
        let VelX = (Math.random() < 0.5 ? -1 : 1) * Math.random() * this.velocityX;
        let VelY = -Math.random() * this.velocityY;

        const maxY = window.innerHeight;
        const maxX = window.innerWidth;
    
        const fall = () => {
            VelY += this.gravity;
    
            const currentTop = parseFloat(textElement.style.top);
            const currentLeft = parseFloat(textElement.style.left);
    
            textElement.style.top = `${currentTop + VelY}px`;
            textElement.style.left = `${currentLeft + VelX}px`;
    
            if (currentTop + VelY < maxY - 50 && currentLeft + VelX < maxX && currentLeft + VelX > 0) {
                requestAnimationFrame(fall);
            } else {
                textElement.remove();
            }
        };
    
        requestAnimationFrame(fall);
    }

    shutdown() {
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        this.showCursor();
        this.textElement.remove();
    }
}

export default AnimalClicks;