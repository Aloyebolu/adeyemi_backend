const warn = (message) => {
  // console.warn(message)
}
export function resolveUserName(user, context = "UnknownContext", options = {}) {

  // throw JSON.stringify(options)
  const clean = (v) => {
    if (typeof v !== "string") return null;

    const trimmed = v.trim();
    if (!trimmed) return null;

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const normalizeTitle = (title) => {
    if (!title) return null;
    const t = title.toLowerCase().replace(".", "");
    const allowed = ["mr", "mrs", "ms", "dr", "prof"];
    // if (!allowed.includes(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1) + ".";
  };

  const makeInitial = (name) =>
    name ? name.charAt(0).toUpperCase() + "." : null;

  const useInitials = options.initials == true;
  const full = options.full === true;

  if (!user) {
    const empty = {
      name: null,
      first_name: null,
      middle_name: null,
      last_name: null,
      formatted: "Unknown"
    };
    return full ? empty : "Unknown";
  }

  // normalize mongoose docs / raw objects
  const u =
    typeof user.toObject === "function"
      ? user.toObject({ getters: false, virtuals: false })
      : user;

  const userId = u._id || "UnknownID";

  const first_name = clean(u.first_name);
  const middle_name = clean(u.middle_name);
  const last_name = clean(u.last_name);
  const title = normalizeTitle(clean(u.title));

  // legacy full name wins
  if (typeof u.name === "string" && u.name.trim() && !first_name) {
    const result = {
      name: u.name.trim(),
      first_name,
      middle_name,
      last_name,
      formatted: u.name.trim()
    };
    return full ? result : result.formatted;
  }

  // build formatted name
  let formatted = null;
  if (first_name || last_name) {
    if (useInitials) {
      const initials = [
        makeInitial(middle_name),
        makeInitial(last_name)
      ].filter(Boolean).join(""); // <- merge initials together
      const parts = [title, initials, first_name].filter(Boolean);
      formatted = parts.join(" ");
    } else {
      const parts = [title, first_name, middle_name, last_name].filter(Boolean);
      formatted = parts.join(" ");
    }
  }



  if (formatted) {
    const result = {
      name: formatted,
      first_name,
      middle_name,
      last_name,
      formatted
    };
    return full ? result : formatted;
  }

  warn(`[${context}] User ${userId} has no resolvable name data.`);

  const fallback = {
    name: null,
    first_name: null,
    middle_name: null,
    last_name: null,
    formatted: "Unknown"
  };

  return full ? fallback : "Unknown";
}

export function formatMatricNumber(matric) {
  if (!matric) return matric;

  const parts = matric.split('/');

  if (parts.length >= 3 && parts[1].length === 4) {
    parts[1] = parts[1].slice(2); // remove the first "20"
  }

  return parts.join('/');
}

export function splitName(name = "") {
  if (!name || typeof name !== "string") {
    return {
      first_name: "",
      middle_name: "",
      last_name: ""
    };
  }

  // Remove extra spaces and split
  const parts = name.trim().split(/\s+/);

  let first_name = "";
  let middle_name = "";
  let last_name = "";

  if (parts.length === 1) {
    first_name = parts[0];
  } else if (parts.length === 2) {
    [first_name, last_name] = parts;
  } else if (parts.length > 2) {
    first_name = parts[0];
    middle_name = parts[parts.length - 1];
    last_name = parts.slice(1, -1).join(" ");
  }

  return {
    first_name,
    middle_name,
    last_name
  };
}