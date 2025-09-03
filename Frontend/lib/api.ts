export async function wakeUpBackend() {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/health`);
      if (!response.ok) {
        throw new Error("Failed to wake backend");
      }
      return true;
    } catch (error) {
      console.error("Wake up failed:", error);
      return false;
    }
  }
