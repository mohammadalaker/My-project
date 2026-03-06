import { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';

export function useBrandLogos() {
    const [logos, setLogos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogos = useCallback(async () => {
        setLoading(true);
        // List files in the 'logos' folder of 'Pic_of_items' bucket
        const { data, error } = await supabase.storage.from('Pic_of_items').list('logos');
        // 'data' might be null if 'logos' doesn't exist yet, that's fine
        if (data) {
            setLogos(data.filter(f => f.name !== '.emptyFolderPlaceholder'));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchLogos();
    }, [fetchLogos]);

    const getLogoUrl = useCallback((groupName) => {
        if (!groupName) return null;
        
        const normalizedGroup = String(groupName).toLowerCase().trim();
        
        // Find if user uploaded a logo
        if (logos.length > 0) {
            const file = logos.find(f => {
                const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')).toLowerCase().trim() || f.name.toLowerCase().trim();
                return nameWithoutExt === normalizedGroup;
            });

            if (file) {
                const { data } = supabase.storage.from('Pic_of_items').getPublicUrl(`logos/${file.name}`);
                // Use updated_at timestamp to avoid caching issues when overwriting
                return `${data.publicUrl}?t=${new Date(file.updated_at).getTime()}`;
            }
        }

        // Hardcoded fallbacks if no user upload is found
        if (normalizedGroup.includes('arçelik') || normalizedGroup.includes('arcelik')) return '/Logo/arçelik Logo.png';
        if (normalizedGroup.includes('babyliss')) return '/Logo/Babyliss logo.png';
        if (normalizedGroup.includes('beko')) return '/Logo/Beko Logo.png';
        if (normalizedGroup.includes('black') && normalizedGroup.includes('decker')) return '/Logo/Black and decker Logo.png';
        if (normalizedGroup.includes('braun')) return '/Logo/Braun Logo.png';
        if (normalizedGroup.includes('campomatic')) return '/Logo/Campomatic Logo.png';
        if (normalizedGroup.includes('conti')) return '/Logo/Conti logo.png';
        if (normalizedGroup.includes('delonghi')) return '/Logo/DeLonghi Logo.png';
        if (normalizedGroup.includes('dyson')) return '/Logo/Dyson Logo.png';
        if (normalizedGroup.includes('fakir')) return '/Logo/Fakir Logo.png';
        if (normalizedGroup.includes('fresh')) return '/Logo/Fresh logo.png';
        if (normalizedGroup.includes('glemgas') || normalizedGroup.includes('glem gas')) return '/Logo/Glemgas logo.png';
        if (normalizedGroup.includes('grundig')) return '/Logo/Grundig Logo.png';
        if (normalizedGroup.includes('kenwood')) return '/Logo/Kenwood Logo.png';
        if (normalizedGroup.includes('korkmaz')) return '/Logo/Korkmaz logo.png';
        if (normalizedGroup.includes('lg')) return '/Logo/LG Logo.jpg';
        if (normalizedGroup.includes('luminarc')) return '/Logo/Luminarc Logo.png';
        if (normalizedGroup.includes('moulinex')) return '/Logo/Moulinex Logo.png';
        if (normalizedGroup.includes('ocean')) return '/Logo/Ocean Logo.png';
        if (normalizedGroup.includes('panasonic')) return '/Logo/Panasonic Logo.png';
        if (normalizedGroup.includes('philips')) return '/Logo/Philips Logo.png';
        if (normalizedGroup.includes('russell') || normalizedGroup.includes('hobbs')) return '/Logo/Russell hobbs Logo.png';
        if (normalizedGroup.includes('samsung')) return '/Logo/Samsung Logo.png';
        if (normalizedGroup.includes('tefal')) return '/Logo/Tefal Logo.png';
        if (normalizedGroup.includes('toshiba')) return '/Logo/Toshiba Logo.png';
        if (normalizedGroup.includes('viper')) return '/Logo/Viper Logo.png';

        return null;
    }, [logos]);

    const uploadLogo = async (groupName, file) => {
        const normalizedGroup = String(groupName).toLowerCase().trim();
        
        // Clean up old files for this group
        const existing = logos.filter(f => {
            const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')).toLowerCase().trim() || f.name.toLowerCase().trim();
            return nameWithoutExt === normalizedGroup;
        });
        
        if (existing.length > 0) {
            await supabase.storage.from('Pic_of_items').remove(existing.map(f => `logos/${f.name}`));
        }

        const ext = file.name.split('.').pop();
        const fileName = `${groupName.trim()}.${ext}`;
        
        const { error } = await supabase.storage.from('Pic_of_items').upload(`logos/${fileName}`, file, {
            upsert: true,
            cacheControl: '3600'
        });
        
        if (!error) {
            await fetchLogos();
            return true;
        }
        return false;
    };

    const removeLogo = async (groupName) => {
        const normalizedGroup = String(groupName).toLowerCase().trim();
        const existing = logos.filter(f => {
            const nameWithoutExt = f.name.substring(0, f.name.lastIndexOf('.')).toLowerCase().trim() || f.name.toLowerCase().trim();
            return nameWithoutExt === normalizedGroup;
        });
        
        if (existing.length > 0) {
            await supabase.storage.from('Pic_of_items').remove(existing.map(f => `logos/${f.name}`));
            await fetchLogos();
            return true;
        }
        return false;
    };

    return { logos, loading, getLogoUrl, uploadLogo, removeLogo, fetchLogos };
}
