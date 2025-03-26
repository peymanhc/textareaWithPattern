import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { PreTagTextareaProps, PreTagTextareaRef } from './types';
import {
    createTextNode,
    createSpaceNode,
    createBRNode,
    createEmptyTextNode,
    createTagElement,
    getCurrentSelection,
    createNewRange,
    setSelectionToRange,
    cleanTextContent,
    cleanHtmlContent,
    removeTrailingBR,
} from './textareaWithPattern';
import 'textarea-pattern-handler/styles.css';

const PreTagTextarea = forwardRef<PreTagTextareaRef, PreTagTextareaProps>(
    (
        { value, setValue, node, className = '', onRemoveTag, fixedText = '', defaultValue = '', id = 'preTagBox' },
        ref,
    ) => {
        const boxRef = useRef<HTMLDivElement>(null);
        const [tagCounter, setTagCounter] = useState(0);
        const [htmlValue, setHtmlValue] = useState('');

        useImperativeHandle(ref, () => ({
            addTag: (tagContent: string) => {
                const box = boxRef.current;
                if (!box) return;

                const selection = getCurrentSelection();
                if (!selection) return;

                const range = selection.getRangeAt(0);
                const tagId = `tag-${tagCounter}`;
                setTagCounter((prev) => prev + 1);

                const tag = createTagElement(tagContent, tagId);

                if (box.contains(range.startContainer)) {
                    range.insertNode(tag);
                    const space = createSpaceNode();
                    tag.after(space);

                    const newRange = createNewRange(space);
                    setSelectionToRange(newRange);
                } else {
                    box.appendChild(tag);
                    box.appendChild(createSpaceNode());
                }

                updateValues(box);
            },
            addText: (textContent: string) => {
                const box = boxRef.current;
                if (!box) return;

                const selection = getCurrentSelection();
                if (!selection) return;

                const range = selection.getRangeAt(0);
                const textNode = createTextNode(textContent);

                if (box.contains(range.startContainer)) {
                    range.insertNode(textNode);
                    const space = createSpaceNode();
                    textNode.after(space);

                    const newRange = createNewRange(space);
                    setSelectionToRange(newRange);
                } else {
                    box.appendChild(textNode);
                    box.appendChild(createSpaceNode());
                }

                updateValues(box);
            },
        }));

        const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            const fragments = text.split('\n');
            const selection = getCurrentSelection();
            const range = selection?.getRangeAt(0);
            const box = e.currentTarget;

            if (!range || !box) return;

            range.deleteContents();

            fragments.forEach((fragment, index) => {
                const textNode = createTextNode(fragment);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);

                if (index < fragments.length - 1) {
                    const br = createBRNode();
                    range.insertNode(br);
                    range.setStartAfter(br);
                    range.collapse(true);
                }
            });

            setSelectionToRange(range);
            updateValues(box);
        };

        const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
            const box = e.currentTarget;
            const selection = getCurrentSelection();

            if (!selection) return;
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    handleEnterKey(box, selection);
                    break;
                case 'Delete':
                case 'Backspace':
                    e.preventDefault();
                    handleDeleteKey(box, selection);
                    break;
                case 'a':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        handleSelectAll(box);
                    }
                    break;
            }
        };

        const handleEnterKey = (box: HTMLDivElement, selection: Selection) => {
            const range = selection.getRangeAt(0);
            const br = createBRNode();
            const emptyText = createEmptyTextNode();

            range.insertNode(br);
            br.after(emptyText);

            const newRange = createNewRange(emptyText);
            setSelectionToRange(newRange);

            updateValues(box);
        };

        const handleDeleteKey = (box: HTMLDivElement, selection: Selection) => {
            const range = selection.getRangeAt(0);
            const fullRange = document.createRange();
            fullRange.selectNodeContents(box);

            const isFullSelection =
                range.compareBoundaryPoints(Range.START_TO_START, fullRange) === 0 &&
                range.compareBoundaryPoints(Range.END_TO_END, fullRange) === 0;

            if (isFullSelection) {
                clearContent(box);
                return;
            }

            const patterns = box.querySelectorAll('span.tag');
            let removedTags = false;

            patterns.forEach((pattern) => {
                if (range.intersectsNode(pattern)) {
                    pattern.remove();
                    removedTags = true;
                }
            });

            if (removedTags) {
                updateValues(box);
                return;
            }

            document.execCommand('delete', false);
            updateValues(box);
        };

        const handleSelectAll = (box: HTMLDivElement) => {
            const range = document.createRange();
            range.selectNodeContents(box);
            setSelectionToRange(range);
        };

        const clearContent = (box: HTMLDivElement) => {
            box.innerHTML = '';
            const emptyText = createTextNode('');
            box.appendChild(emptyText);

            const range = createNewRange(emptyText);
            setSelectionToRange(range);

            updateValues(box);
        };

        const updateValues = (box: HTMLDivElement) => {
            const cleanText = cleanTextContent(box.innerText);
            const cleanHtml = cleanHtmlContent(box.innerHTML);
            removeTrailingBR(box);

            setValue(cleanText);
            setHtmlValue(cleanHtml);
        };

        const handleRemoveTag = (e: React.MouseEvent<HTMLDivElement>) => {
            const target = e.target as HTMLElement;
            if (target.id.includes('tag')) {
                const tagText = target.innerText;
                const parentElement = target.parentElement as HTMLDivElement;
                target.remove();
                onRemoveTag?.(tagText);
                updateValues(parentElement);
            }
        };

        useEffect(() => {
            if (boxRef.current) {
                const initialContent = htmlValue || defaultValue;
                if (initialContent) {
                    boxRef.current.innerHTML = initialContent.replace(fixedText, '').replace(/\n/g, '<br>');
                }
            }
        }, [defaultValue, fixedText]);

        const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
            const box = e.currentTarget;
            updateValues(box);
        };

        const elementProps = {
            ref: boxRef,
            contentEditable: true,
            onPaste: handlePaste,
            onClick: handleRemoveTag,
            onKeyDown: handleKeyDown,
            onInput: handleInput,
            id,
            className: `${className} ${value?.length == 0 && 'placeholderOfTextareaWithPattern'} patternBox`,
        };

        return node ? React.cloneElement(node, elementProps) : <div {...elementProps} />;
    },
);

export default PreTagTextarea;
