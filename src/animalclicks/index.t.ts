declare module 'your-package-name' {
    class AnimalClicks {
      constructor(options?: {
        innerText?: string[];
        time?: number;
        angle?: number;
        velocityX?: number;
        velocityY?: number;
        gravity?: number;
        dx?: number;
        dy?: number;
        effects?: {
          random?: boolean;
          physics?: boolean;
          fade?: boolean;
          hideCursor?: boolean;
        };
        fontSize?: string;
      });
  
      handleClick: (event: MouseEvent) => void;
      mouseMoveHandler: (event: MouseEvent) => void;
    }
  
    export default AnimalClicks;
}