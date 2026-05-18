/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */
/**
 * Simple widget to display text. It supports markdown, provided in the widget configuration.
 * Used to display sample help or reference pages.
 * 
 * It supports relative links to navigate between pages of the app.
 * 
 * TODO: Later, support:
 *  - Files as data source
 *  - URLs to load remote data
 */

import { useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import Markdown, { defaultUrlTransform } from 'react-markdown';
import { makeStyles } from 'tss-react/mui';
import { isString } from 'lodash';

const useStyles = makeStyles()(theme => ({
    textWidget: {
        ul: {
            'marginBlockStart': '0.5em',
            'marginBlockEnd': '0.5em',
            'paddingInlineStart': '40px'
        },        
        p: {
            'marginBlockStart': '0.5em',
            'marginBlockEnd': '0.5em',
        },
        a: {
            color: theme.palette.text.darkBlue,
        }
    }
}));

const TextWidgetComponent = ({ config }) => {
    const { classes } = useStyles();
    const navigate = useNavigate();

    const handleNavigate = useCallback((href) => {
        navigate(href);
        console.log("NAVIGATE TO", href)
        // const pathname = new DashboardUrl().dashboard(dashboardId).build()
        // navigate(`${pathname}${location.search}`);
    }, [navigate]);

    const Link = useCallback(({ href, children, ...rest }) => {
        if (isString(href) && href.startsWith('/')) {
            // Relative link. Handle it with navigate within the app
            return (
                <a href="#" {...rest} onClick={() => handleNavigate(href)}>{children}</a>
            )
        }
        // if (isString(href) && href.startsWith('oro://')) {
        //     // ORO link. TODO, to implement our custom links.
        //     return (
        //         <a href="#" {...rest} onClick={handleClick}>{children}</a>
        //     )
        // }
        // Let react-markdown handle any other link (which includes sanitizing the href)
        return <a href={href} {...rest} target="_blank">{children}</a>;
    }, []);
    
    const components = useMemo(() => ({
        'a': Link,
    }), []);


    if (!config?.text) {
        return null;
    }

    return (
        <div className={classes.textWidget}>
            <Markdown 
                components={components}
            >
                {config.text}
            </Markdown>
        </div>
    )
}

export default TextWidgetComponent;