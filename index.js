/* -*- tab-width: 4; indent-tabs-mode: t; -*- */
/**
	Copyright (C) 2020  Menhera.org

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

	https://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

'use strict';


const shadowObjects = new WeakMap;

const getShadow = o =>
	shadowObjects.has (o)
		? shadowObjects.get (o)
		: (shadowObjects.set (o, Object.create (null))
			, shadowObjects.get (o));


const Element = exports.Element = class Element
{
	static get VOID_ELEMENTS ()
	{
		return [
			'area',
			'base',
			'br',
			'col',
			'embed',
			'hr',
			'img',
			'input',
			'link',
			'meta',
			'param',
			'source',
			'track',
			'wbr',
		];
	}
	
	static get RAW_TEXT_ELEMENTS ()
	{
		return [
			'script',
			'style',
		];
	}
	
	static get ESCAPABLE_RAW_TEXT_ELEMENTS ()
	{
		return [
			'textarea',
			'title',
		];
	}
	
	static validateToken (token)
	{
		return !!String (token).match (
			/^[_A-Za-z][-_.A-Za-z0-9]*(:[_A-Za-z][-_.A-Za-z0-9]*)?$/u
		);
	}
	
	static validateText (text)
	{
		return !!String (text).match (
			/^[\u{9}\u{a}\u{d}\u{20}-\u{d7ff}\u{e000}\u{fffd}\u{10000}-\u{10ffff}]*$/u
		);
	}
	
	static escapeText (text)
	{
		if (!Element.validateText (text)) {
			throw new TypeError ('Invalid text data');
		}
		
		return text.replace (/&/gu, '&amp;')
			.replace (/</gu, '&lt;')
			.replace (/>/gu, '&gt;')
			.replace (/'/gu, '&apos;')
			.replace (/"/gu, '&quot;');
	}
	
	constructor (tagName)
	{
		const shadow = getShadow (this);
		shadow.attributes = Object.create (null);
		shadow.children = [];
		shadow.realName = String (tagName);
		if (!Element.validateToken (shadow.realName)) {
			throw new TypeError ('Unsafe tag name');
		}
		shadow.name = String (tagName).toLowerCase ();
		shadow.void = Element.VOID_ELEMENTS.includes (shadow.name);
		shadow.raw = Element.RAW_TEXT_ELEMENTS.includes (shadow.name)
			|| Element.ESCAPABLE_RAW_TEXT_ELEMENTS.includes (shadow.name);
		shadow.escapable = !Element.RAW_TEXT_ELEMENTS.includes (shadow.name);
	}
	
	append (...children)
	{
		const shadow = getShadow (this);
		if (shadow.void) {
			throw new TypeError ('Void element');
		}
		
		if (!shadow.escapable) {
			throw new TypeError ('Raw text elements should not have contents');
		}
		
		const tmp = [];
		for (let child of children) {
			if (child instanceof Element) {
				if (child.parentElement) {
					throw new TypeError ('Already a child');
				}
				
				if (shadow.raw) {
					throw new TypeError ('Raw text elements cannot have element children');
				}
				
				let current = this;
				do {
					if (current == child) {
						throw new TypeError ('Cyclic reference');
					}
				} while (current = current.parentElement);
			} else {
				if (!Element.validateText (child)) {
					throw new TypeError ('Invalid text data');
				}
			}
		}
		
		for (let child of children) {
			if (child instanceof Element) {
				const childShadow = getShadow (child);
				childShadow.parent = this;
				childShadow.parentIndex = shadow.children.length;
				
				tmp.push (child);
			} else {
				tmp.push (String (child));
			}
		}
		
		shadow.children.push (... tmp);
	}
	
	remove ()
	{
		const shadow = getShadow (this);
		if (!shadow.parent) {
			return;
		}
		const parentShadow = getShadow (shadow.parent);
		delete parentShadow.children[shadow.parentIndex];
		delete shadow.parent;
		delete shadow.parentIndex;
	}
	
	get parentElement ()
	{
		const shadow = getShadow (this);
		return shadow.parent || null;
	}
	
	get ownerDocument ()
	{
		const shadow = getShadow (this);
		return shadow.parent ? shadow.parent.ownerDocument : (shadow.document || null);
	}
	
	get children ()
	{
		const shadow = getShadow (this);
		return shadow.children.filter (child => 'undefined' !== typeof child);
	}
	
	get tagName ()
	{
		const shadow = getShadow (this);
		return shadow.realName.toUpperCase ();
	}
	
	setAttribute (name, value)
	{
		const shadow = getShadow (this);
		if (!Element.validateToken (name)) {
			throw new TypeError ('Unsafe atttribute name');
		}
		if (!Element.validateText (value)) {
			throw new TypeError ('Unsafe atttribute value');
		}
		shadow.attributes[String (name)] = String (value);
	}
	
	getAttribute (name)
	{
		const shadow = getShadow (this);
		return shadow.attributes[String (name)];
	}
	
	hasAttribute (name)
	{
		const shadow = getShadow (this);
		return String (name) in shadow.attributes;
	}
	
	removeAttribute (name)
	{
		const shadow = getShadow (this);
		delete shadow.attributes[String (name)];
	}
	
	clear ()
	{
		const shadow = getShadow (this);
		for (let child of shadow.children) {
			if ('undefined' == typeof child) continue;
			if (child instanceof Element) {
				child.remove ();
			}
		}
		shadow.children = [];
	}
	
	get innerHTML ()
	{
		const shadow = getShadow (this);
		let str = '';
		for (let child of shadow.children) {
			if ('undefined' == typeof child) continue;
			if (child instanceof Element) {
				str += child;
			} else {
				str += Element.escapeText (child);
			}
		}
		return str;
	}
	
	get innerText ()
	{
		const shadow = getShadow (this);
		let str = '';
		for (let child of shadow.children) {
			if ('undefined' == typeof child) continue;
			if (child instanceof Element) {
				str += child.innerText;
			} else {
				str += Element.escapeText (child);
			}
		}
		return str;
	}
	
	set innerText (aText)
	{
		const text = String (aText);
		this.clear ();
		this.append (text);
	}
	
	get outerHTML ()
	{
		const shadow = getShadow (this);
		let str = `<${shadow.realName}`;
		
		const keys = Reflect.ownKeys (shadow.attributes).sort ();
		for (let name of keys) {
			str += `\t${name}='${Element.escapeText (shadow.attributes[name])}'`;
		}
		if (shadow.void) {
			str += `/>`;
		} else {
			str += `>${this.innerHTML}</${shadow.realName}>`;
		}
		
		return str;
	}
	
	toString ()
	{
		return this.outerHTML;
	}
};


exports.Document = class Document
{
	constructor ()
	{
		const shadow = getShadow (this);
		shadow.html = this.createElement ('html');
		const htmlShadow = getShadow (shadow.html);
		htmlShadow.document = this;
		
		shadow.html.setAttribute ('xmlns', 'http://www.w3.org/1999/xhtml');
		shadow.html.setAttribute ('xmlns:xlink', 'http://www.w3.org/1999/xlink');
		
		shadow.head = this.createElement ('head');
		shadow.html.append (shadow.head);
		
		shadow.body = this.createElement ('body');
		shadow.html.append (shadow.body);
		
		shadow.charset = this.createElement ('meta');
		shadow.charset.setAttribute ('charset', 'UTF-8');
		shadow.head.append (shadow.charset);
		
		shadow.title = this.createElement ('title');
		shadow.head.append (shadow.title);
	}
	
	createElement (tagName)
	{
		return new Element (tagName);
	}
	
	get documentElement ()
	{
		const shadow = getShadow (this);
		return shadow.html || null;
	}
	
	get head ()
	{
		const shadow = getShadow (this);
		return shadow.head || null;
	}
	
	get body ()
	{
		const shadow = getShadow (this);
		return shadow.body || null;
	}
	
	get title ()
	{
		const shadow = getShadow (this);
		return shadow.title.innerText;
	}
	
	set title (aTitle)
	{
		const shadow = getShadow (this);
		shadow.title.innerText = aTitle;
	}
	
	toString ()
	{
		return '<!DOCTYPE\thtml>' + this.documentElement;
	}
};

