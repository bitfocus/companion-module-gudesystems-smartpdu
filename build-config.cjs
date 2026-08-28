// ssh2 (and its optional native addons cpu-features/sshcrypto) can't be statically
// bundled by webpack - their optional native requires only resolve at runtime, wrapped
// in try/catch upstream. Ship it as a real dependency alongside the packaged module
// instead of trying to bundle it. See @companion-module/tools build-util.js.
module.exports = {
	externals: {
		ssh2: 'commonjs ssh2',
	},
}
