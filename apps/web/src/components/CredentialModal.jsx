import { useEffect, useState } from "react";
import ActionButton from "./ActionButton.jsx";

const SECRET_FIELDS = new Set(["GROVE_API_KEY", "MONGODB_URI"]);

export default function CredentialModal({ demo, open, onClose, onSave, saving }) {
  const [values, setValues] = useState({});

  useEffect(() => {
    if (!demo) {
      setValues({});
      return;
    }

    setValues(demo.configuredValues ?? {});
  }, [demo]);

  if (!open || !demo) {
    return null;
  }

  const editableKeys = (
    demo.forceCredentialKeys?.length
      ? demo.forceCredentialKeys
      : demo.missingEnv.length
        ? demo.missingEnv
        : demo.requiredEnv
  ).filter((key, index, list) => list.indexOf(key) === index);

  function updateValue(key, value) {
    setValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave(values);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-card__header">
          <div>
            <p className="modal-card__eyebrow">Local-only credentials</p>
            <h2>Configure {demo.name}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="modal-card__description">
          Set your MongoDB URI and Grove Gateway API key. The runtime calls Grove at{" "}
          <code>grove-gateway-prod.azure-api.net</code> using the OpenAI Responses API. Default
          model is <code>gpt-5.5</code>.
        </p>
        {demo.preflightError ? <p className="dashboard__error">{demo.preflightError}</p> : null}

        <form className="credential-form" onSubmit={handleSubmit}>
          {editableKeys.map((key) => (
            <label key={key} className="credential-form__field">
              <span>{key}</span>
              <input
                type={SECRET_FIELDS.has(key) ? "password" : "text"}
                autoComplete="off"
                value={values[key] ?? ""}
                onChange={(event) => updateValue(key, event.target.value)}
                placeholder={`Enter ${key}`}
              />
            </label>
          ))}

          <div className="modal-card__actions">
            <ActionButton type="submit" tone="accent" busy={saving}>
              Save credentials
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
