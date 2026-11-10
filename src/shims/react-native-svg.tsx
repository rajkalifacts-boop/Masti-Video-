import React from 'react';

export const Svg: React.FC<any> = ({ width = '100%', height = '100%', children, style, ...props }) => (
  <svg width={width} height={height} style={style} {...props}>
    {children}
  </svg>
);

export const Circle: React.FC<any> = ({ cx, cy, r, fill, stroke, strokeWidth, strokeDasharray, strokeDashoffset, ...props }) => (
  <circle
    cx={cx}
    cy={cy}
    r={r}
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeDasharray={strokeDasharray}
    strokeDashoffset={strokeDashoffset}
    {...props}
  />
);

export const Rect: React.FC<any> = (props) => <rect {...props} />;
export const Defs: React.FC<any> = (props) => <defs {...props} />;
export const LinearGradient: React.FC<any> = (props) => <linearGradient {...props} />;
export const Stop: React.FC<any> = (props) => <stop {...props} />;
export const Path: React.FC<any> = (props) => <path {...props} />;
export const G: React.FC<any> = (props) => <g {...props} />;

export default Svg;
