import React, { useCallback } from 'react';

export const ResizeHandle = ({ onResize, direction = 'horizontal' }) => {
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;

        document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent) => {
            if (direction === 'horizontal') {
                onResize(moveEvent.clientX, moveEvent.clientX - startX);
            } else {
                onResize(moveEvent.clientY, moveEvent.clientY - startY);
            }
        };

        const handleMouseUp = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [onResize, direction]);

    return (
        <div
            onMouseDown={handleMouseDown}
            className={`
                ${direction === 'horizontal' ? 'w-1 cursor-col-resize hover:w-1 group' : 'h-1 cursor-row-resize hover:h-1 group'}
                flex-shrink-0 relative z-10
            `}
        >
            <div className={`
                ${direction === 'horizontal' ? 'w-1 h-full hover:bg-corporate-400 dark:hover:bg-corporate-600' : 'h-1 w-full hover:bg-corporate-400 dark:hover:bg-corporate-600'}
                bg-transparent transition-colors duration-150
                group-active:bg-corporate-500
            `} />
        </div>
    );
};
