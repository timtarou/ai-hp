import Foundation

// One worker at a time. Drain both pipes concurrently to avoid waiting on a full pipe.
final class CLIWorker {
    private let lock = NSLock()
    private var process: Process?
    private var cancelled = false

    func cancel() {
        lock.lock()
        cancelled = true
        let running = process
        lock.unlock()
        if let running, running.isRunning { running.terminate() }
    }

    func query(node: String, cli: URL, environment: [String: String], completion: @escaping (Result<UsageEnvelope, Error>) -> Void) {
        DispatchQueue.global(qos: .utility).async {
            let child = Process()
            child.executableURL = URL(fileURLWithPath: node)
            child.arguments = [cli.path, "--json", "--fresh-only", "--lang", "ja"]
            child.environment = environment
            child.currentDirectoryURL = FileManager.default.temporaryDirectory
            let output = Pipe(), errors = Pipe()
            child.standardOutput = output
            child.standardError = errors
            child.standardInput = FileHandle.nullDevice
            do {
                self.lock.lock()
                if self.cancelled { self.lock.unlock(); throw AppError.message("更新を中止しました。") }
                do { try child.run() } catch { self.lock.unlock(); throw error }
                self.process = child
                self.lock.unlock()
                let captured = Capture()
                let readers = DispatchGroup()
                readers.enter()
                DispatchQueue.global(qos: .utility).async {
                    captured.output = output.fileHandleForReading.readDataToEndOfFile()
                    readers.leave()
                }
                readers.enter()
                DispatchQueue.global(qos: .utility).async {
                    captured.errors = errors.fileHandleForReading.readDataToEndOfFile()
                    readers.leave()
                }
                let deadline = DispatchWorkItem { if child.isRunning { child.terminate() } }
                DispatchQueue.global().asyncAfter(deadline: .now() + 75, execute: deadline)
                child.waitUntilExit()
                deadline.cancel()
                readers.wait()
                self.lock.lock()
                self.process = nil
                let wasCancelled = self.cancelled
                self.lock.unlock()
                if wasCancelled { throw AppError.message("更新を中止しました。") }
                if let result = try? UsageEnvelope.decode(captured.output) {
                    completion(.success(result))
                } else {
                    let detail = String(data: captured.errors.suffix(1500), encoding: .utf8) ?? ""
                    throw AppError.message("取得に失敗しました（終了コード \(child.terminationStatus)）。\n\(detail)")
                }
            } catch { completion(.failure(error)) }
        }
    }
    private final class Capture {
        var output = Data()
        var errors = Data()
    }
}
