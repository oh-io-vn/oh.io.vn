// A token belongs to one submission. Waiting callers never reuse a consumed token.
export class VerificationGate {
  private token = "";
  private issuedAt = 0;
  private waiter: {
    resolve: (token: string) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  get ready() {
    return !!this.token && Date.now() - this.issuedAt < 290000;
  }

  accept(token: string) {
    if (!token) return;
    const waiter = this.waiter;
    if (waiter) {
      this.waiter = null;
      clearTimeout(waiter.timer);
      waiter.resolve(token);
    } else {
      this.token = token;
      this.issuedAt = Date.now();
    }
  }

  invalidate() {
    this.token = "";
    this.issuedAt = 0;
  }

  fail(message: string) {
    this.invalidate();
    if (this.waiter) {
      clearTimeout(this.waiter.timer);
      this.waiter.reject(new Error(message));
      this.waiter = null;
    }
  }

  take(timeout = 60000): Promise<string> {
    if (this.ready) {
      const token = this.token;
      this.invalidate();
      return Promise.resolve(token);
    }
    this.invalidate();
    if (this.waiter)
      return Promise.reject(new Error("Đang có yêu cầu chờ xác minh."));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(
          new Error("Xác minh mất nhiều thời gian. Hãy thử xác minh lại."),
        );
      }, timeout);
      this.waiter = { resolve, reject, timer };
    });
  }
}
