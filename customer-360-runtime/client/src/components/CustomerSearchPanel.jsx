import { useEffect, useId, useRef, useState } from "react";
import { autocompleteCustomers } from "../api.js";

const SEGMENTS = ["", "postpaid", "prepaid", "business", "home_internet"];

function formatSuggestionLabel(customer) {
  return `${customer.firstName} ${customer.lastName}`;
}

function formatSuggestionMeta(customer) {
  return [customer.msisdn, customer.customerId].filter(Boolean).join(" · ");
}

function suggestionInitials(customer) {
  const first = customer.firstName?.[0] ?? "";
  const last = customer.lastName?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

export default function CustomerSearchPanel({
  query,
  segment,
  customers,
  searchMode,
  selectedCustomerId,
  onQueryChange,
  onSegmentChange,
  onSelectCustomer
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setActiveIndex(-1);
      return undefined;
    }

    setLoadingSuggestions(true);
    const timeout = window.setTimeout(() => {
      autocompleteCustomers({ q: trimmed, segment, limit: 8 })
        .then((payload) => {
          setSuggestions(payload.customers ?? []);
          setSuggestionsOpen(true);
          setActiveIndex(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setSuggestionsOpen(false);
        })
        .finally(() => {
          setLoadingSuggestions(false);
        });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [query, segment]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setSuggestionsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function chooseSuggestion(customer) {
    onQueryChange(formatSuggestionLabel(customer));
    onSelectCustomer(customer.customerId);
    setSuggestionsOpen(false);
    setActiveIndex(-1);
  }

  function handleInputKeyDown(event) {
    if (!suggestionsOpen || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <section className="customer-search">
      <div className="customer-search__controls">
        <div className="customer-search__autocomplete" ref={rootRef}>
          <input
            type="search"
            value={query}
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            onChange={(event) => {
              onQueryChange(event.target.value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 2 && suggestions.length) {
                setSuggestionsOpen(true);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Start typing — fuzzy match on name, email, phone, or ID"
          />

          {suggestionsOpen && query.trim().length >= 2 ? (
            <ul id={listboxId} className="customer-search__suggestions" role="listbox">
              {loadingSuggestions ? (
                <li className="customer-search__suggestion customer-search__suggestion--status">
                  Searching Atlas autocomplete…
                </li>
              ) : null}

              {!loadingSuggestions && suggestions.length === 0 ? (
                <li className="customer-search__suggestion customer-search__suggestion--status">
                  No autocomplete matches
                </li>
              ) : null}

              {!loadingSuggestions
                ? suggestions.map((customer, index) => (
                    <li
                      key={customer.customerId}
                      className="customer-search__suggestion-item"
                      role="option"
                      aria-selected={activeIndex === index}
                    >
                      <button
                        type="button"
                        className={`customer-search__suggestion${
                          activeIndex === index ? " customer-search__suggestion--active" : ""
                        }`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseSuggestion(customer)}
                      >
                        <span className="customer-search__suggestion-avatar" aria-hidden="true">
                          {suggestionInitials(customer)}
                        </span>
                        <span className="customer-search__suggestion-body">
                          <strong>{formatSuggestionLabel(customer)}</strong>
                          <span className="customer-search__suggestion-meta">
                            {formatSuggestionMeta(customer)}
                          </span>
                        </span>
                        {customer.segment ? (
                          <span className="customer-search__suggestion-tag">{customer.segment}</span>
                        ) : null}
                      </button>
                    </li>
                  ))
                : null}
            </ul>
          ) : null}
        </div>

        <select value={segment} onChange={(event) => onSegmentChange(event.target.value)}>
          {SEGMENTS.map((value) => (
            <option key={value || "all"} value={value}>
              {value ? value.replace("_", " ") : "All segments"}
            </option>
          ))}
        </select>
      </div>

      {searchMode === "regex_degraded" ? (
        <p className="customer-search__mode badge badge--warning" role="status">
          Customer search mode: <strong>regex_degraded</strong> (Atlas Search unavailable or returned no matches)
        </p>
      ) : null}

      <div className="customer-search__list">
        {customers.length === 0 ? (
          <p className="customer-search__empty">No customers match this filter.</p>
        ) : (
          customers.map((customer) => (
            <button
              key={customer.customerId}
              type="button"
              className={`customer-search__item${
                selectedCustomerId === customer.customerId ? " customer-search__item--active" : ""
              }`}
              onClick={() => onSelectCustomer(customer.customerId)}
            >
              <div>
                <strong>
                  {customer.firstName} {customer.lastName}
                </strong>
                <span>{customer.customerId}</span>
              </div>
              <div className="customer-search__meta">
                <span>{customer.segment}</span>
                <span>{Math.round((customer.churnRisk ?? 0) * 100)}% risk</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
