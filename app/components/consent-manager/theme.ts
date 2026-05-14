import type { Theme } from '@c15t/nextjs';

export const theme: Theme = {
	colors: {
		primary: '#4a6767',        // petroleum-400
		primaryHover: '#335554',   // petroleum-500
		surface: '#ffffff',
		surfaceHover: '#e7e9e6',   // petroleum-50
		border: '#d7dbd9',         // petroleum-100
		borderHover: '#4a6767',    // petroleum-400
		text: '#103838',           // petroleum-700
		textMuted: '#4a6767',      // petroleum-400
		textOnPrimary: '#ffffff',
		switchTrack: '#d7dbd9',    // petroleum-100
		switchTrackActive: '#4a6767', // petroleum-400
		switchThumb: '#ffffff',
	},
	typography: {
		fontFamily: 'var(--font-dm-sans), system-ui, -apple-system, sans-serif',
	},
	radius: {
		sm: '0.375rem',
		md: '0.625rem',
		lg: '1rem',
		full: '9999px',
	},
	slots: {
		consentBannerCard: 'border border-[#d7dbd9] bg-white shadow-lg',
		consentDialogCard: 'border border-[#d7dbd9] bg-white shadow-xl',
		consentBannerTitle: 'text-[#103838] font-semibold',
		consentBannerDescription: 'text-[#4a6767]',
		consentDialogTitle: 'text-[#103838] font-semibold',
		consentDialogDescription: 'text-[#4a6767]',
		consentWidgetAccordion: 'border border-[#d7dbd9]',
		buttonPrimary:
			'bg-[#4a6767] text-white hover:bg-[#335554] transition-colors',
		buttonSecondary:
			'bg-white text-[#103838] border border-[#d7dbd9] hover:bg-[#e7e9e6] transition-colors',
	},
};
