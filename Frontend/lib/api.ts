export const wakeUpBackend = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/ping`, { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to wake backend");
      }
      return true;
    } catch (err) {
      console.error("Wake up failed:", err);
      return false;
    }
  };
  