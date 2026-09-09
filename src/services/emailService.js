// ==========================================
// Resend HTTPS Email Dispatch Service
// ==========================================

export async function sendTaskEmail({ taskId, recipient, title, description, deadline, priority, isTest = false }) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        recipient,
        title,
        description,
        deadline,
        priority,
        isTest
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch email');
    }
    return { success: true, message: data.message || 'Email dispatched successfully!', id: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
