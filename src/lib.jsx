import React from "react";
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-BookLeaf-Request": "1",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status === 204) return {};
  const result = await response.json();
  if (!response.ok) {
    const e = new Error(
      result.error?.fields?.map((f) => `${f.path}: ${f.message}`).join(" · ") ||
        result.error?.message ||
        "Request failed.",
    );
    e.status = response.status;
    throw e;
  }
  return result;
}
export const money = (n) =>
  n == null
    ? "Not set"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(n);
export const date = (n) =>
  n
    ? new Date(n).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not yet";
export const stamp = (n) =>
  new Date(n).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const badge = (text) => (
  <span className={`badge ${text.toLowerCase().replaceAll(" ", "-")}`}>
    {text}
  </span>
);
