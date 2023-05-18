import typescript from '@rollup/plugin-typescript';

export default {
	input: 'src/index.ts',
	output: [
		{
			file: './dist/umd/index.js',
			format: 'amd'
		}
	],
	plugins: [typescript()]
};
