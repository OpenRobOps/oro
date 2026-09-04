import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'OpenRobOps',
  tagline: 'The Open-Source Robot Operations Platform',
  favicon: 'img/favicon.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://openrobops.org',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'OpenRobOps', // Usually your GitHub org/user name.
  projectName: 'oro', // Usually your repo name.
  trailingSlash: false, // From Netlify tutorial

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  plugins: [
    // Apply the stored theme choice before first paint. Runs after
    // theme-classic's own color-mode script (site plugins inject after preset
    // plugins), so setting data-theme here wins and the ColorModeProvider
    // adopts it on hydration.
    function oroThemeInit() {
      return {
        name: 'oro-theme-init',
        injectHtmlTags: () => ({
          preBodyTags: [
            {
              tagName: 'script',
              innerHTML: `(function(){try{var t=localStorage.getItem('oro-theme')||'monokai';if(t!=='oro'){document.documentElement.setAttribute('data-oro-theme',t);var m=t==='rose-pine-dawn'?'light':'dark';document.documentElement.setAttribute('data-theme',m);document.documentElement.setAttribute('data-theme-choice',m);}}catch(e){}})();`,
            },
          ],
        }),
      };
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/OpenRobOps/oro/tree/main/website/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          editUrl:
            'https://github.com/OpenRobOps/oro/tree/main/website/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/full-logo-small-size.svg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true
    },
    navbar: {
      title: 'OpenRobOps',
      logo: {
        // src is unused at runtime — src/theme/Logo renders the lockup inline
        // with theme CSS vars — but the schema requires it and it documents
        // the canonical asset.
        alt: 'OpenRobOps Logo',
        src: 'img/full-logo-small-size.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {to: '/docs/api/overview', label: 'API', position: 'left'},
        {to: '/docs/iso21423/overview', label: 'ISO 21423', position: 'left'},
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          type: 'custom-oroThemePicker',
          position: 'right',
        },
        {
          href: 'https://github.com/OpenRobOps/oro',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/getting-started/intro',
            },
            {
              label: 'API Reference',
              to: '/docs/api/overview',
            },
            {
              label: 'ISO 21423',
              to: '/docs/iso21423/overview',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Discussions',
              href: 'https://github.com/orgs/OpenRobOps/discussions',
            },
            {
              label: 'Report an issue',
              href: 'https://github.com/OpenRobOps/oro/issues',
            },
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/openrobops',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/OpenRobOps/oro',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} OSRF. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
