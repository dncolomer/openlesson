"use client";

import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

export function DocsMagiTab({ children }: { id: string; label: string; children: ReactNode }) {
  return <>{children}</>;
}

const tabClass = (selected: boolean, labels: "title" | "code") =>
  labels === "code"
    ? `flex shrink-0 items-center justify-center rounded-none border-r border-white/15 px-2 py-1.5 font-mono text-[10px] last:border-r-0 ${
        selected ? "bg-white text-black" : "bg-black text-neutral-500 hover:text-white"
      }`
    : `flex min-w-0 flex-1 items-center justify-center rounded-none border-r border-white/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[2px] last:border-r-0 ${
        selected ? "bg-white text-black" : "bg-black text-neutral-500 hover:text-white"
      }`;

export function DocsMagiTabs({
  children,
  "data-tabs": dataTabs,
  labels = "title",
}: {
  children: ReactNode;
  "data-tabs"?: string;
  labels?: "title" | "code";
}) {
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<{ id: string; label: string; children: ReactNode }> =>
      isValidElement(child) && typeof (child.props as { id?: unknown }).id === "string",
  );
  const first = tabs[0]?.props.id ?? "";
  const [active, setActive] = useState(first);
  if (!tabs.length) return null;
  const current = tabs.some((tab) => tab.props.id === active) ? active : first;
  return (
    <div data-docs-tabs={dataTabs || ""} data-docs-tab-labels={labels}>
      <div role="tablist" className="flex shrink-0 flex-wrap border-b border-white/25 bg-black">
        {tabs.map((tab) => {
          const selected = tab.props.id === current;
          return (
            <button
              key={tab.props.id}
              type="button"
              role="tab"
              data-docs-tab={tab.props.id}
              aria-selected={selected}
              onClick={() => setActive(tab.props.id)}
              className={tabClass(selected, labels)}
            >
              {tab.props.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.props.id}
          role="tabpanel"
          hidden={tab.props.id !== current}
          data-docs-tab-panel={tab.props.id}
        >
          {tab.props.children}
        </div>
      ))}
    </div>
  );
}
