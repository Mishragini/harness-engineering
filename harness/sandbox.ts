import vm from "node:vm"

type SandboxApi = Record<string, unknown>

async function withTimeout<T>(pending: Promise<T>, ms: number) {
    return Promise.race([
        pending,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`execution timed out after ${ms}ms`)), ms))
    ])
}

export async function runInSandbox(
    code: string,
    api: SandboxApi,
    opts: { timeoutMs?: number } = {}
) {
    const timeoutMs = opts.timeoutMs ?? 2000
    const logs: string[] = []
    const context = vm.createContext({
        tools: {
            getCharges: api.getCharges,
            searchKnowledgeBase: api.searchKnowledgeBase
        },
        console: {
            log: (...args: unknown[]) => logs.push(args.map(String).join(" "))
        }
    })

    const wrapped = `(async()=>{${code}})()`
    try {
        const pending = vm.runInContext(wrapped, context, { timeout: timeoutMs })

        const result = await withTimeout(pending, timeoutMs)
        return { ok: true, result, logs }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err), logs };
    }

}