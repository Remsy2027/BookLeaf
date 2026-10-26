import React from "react";
import { Leaf } from "lucide-react";

export function Brand() {
  return (
    <div className="brand">
      <span>
        <Leaf size={25} />
      </span>
      <div>
        bookleaf<small>PUBLISHING</small>
      </div>
    </div>
  );
}
export function Nav({ icon: Icon, children, ...props }) {
  const { active, ...rest } = props;
  return (
    <button className={`nav-item ${active ? "active" : ""}`} {...rest}>
      <Icon size={18} />
      {children}
    </button>
  );
}
export function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, note, icon: Icon }) {
  return (
    <div className="stat">
      <span>
        {label}
        {Icon && <Icon size={16} />}
      </span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
