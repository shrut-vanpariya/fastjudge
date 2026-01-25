/**
 * esbuild configuration for webview React app
 */

const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function build() {
    const ctx = await esbuild.context({
        entryPoints: ['src/ui/webview/app/index.tsx'],
        bundle: true,
        outfile: 'out/webview/webview.js',
        format: 'iife',
        platform: 'browser',
        target: 'es2020',
        minify: production,
        sourcemap: !production,

        define: {
            'process.env.NODE_ENV': production ? '"production"' : '"development"',
        },
    });

    if (watch) {
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await ctx.rebuild();
        await ctx.dispose();
        console.log('Webview build complete!');
    }
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
