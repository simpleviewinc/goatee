import config from "@simpleview/eslint-config-dms/typescript";

export default [
	config,
	{
		ignores: [
			".pnp.cjs",
			".pnp.loader.mjs",
			".yarn/*",
			"dist/*"
		]
	}
]
