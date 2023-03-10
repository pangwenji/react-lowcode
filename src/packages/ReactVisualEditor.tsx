import './editor.scss'
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Tooltip} from "antd";
import {VisualEditorBlock, VisualEditorComponent, VisualEditorModelValue, VisualEditorOption} from "./editor.utils";
import {useModel} from "./utils/useModel";
import {VisualEditorBlockRender, VisualSlot} from "./ReactVisualEditorBlock";
import {usePlainEvent} from "./plugins/event";
import {useVisualCommander} from "./editor.command";
import classnames from 'classnames';
import {delay} from "./utils/delay";

export const ReactVisualEditor: React.FC<{
    value: VisualEditorModelValue,
    option: VisualEditorOption,
    formData: Record<string, any>,
    customBlockProps?: Record<string, (() => Record<string, any>) | Record<string, any>>,
    preview?: boolean,
    welt?: number,

    onChange?: (val: VisualEditorModelValue) => void,
    onUpdatePreview?: (val?: boolean) => void,
    onDragstart?: (blocks: VisualEditorBlock[]) => void,
    onDragend?: (blocks: VisualEditorBlock[]) => void,

    children?: VisualSlot,
}> = (props) => {

    /*model*/
    const previewModel = useModel(props.preview, props.onUpdatePreview)
    const dataModel = useModel(props.value, props.onChange)
    /*state*/
    const [selectBlock, setSelectBlock] = useState(null as null | VisualEditorBlock)
    const [editFlag, setEditFlag] = useState(false)
    /*ref*/
    const containerRef = useRef({} as HTMLDivElement)
    const bodyRef = useRef({} as HTMLDivElement)
    const event = usePlainEvent({
        dragstart: () => {!!props.onDragstart && props.onDragstart(dataModel.value.blocks)},
        dragend: () => {!!props.onDragend && props.onDragend(dataModel.value.blocks)},
    })
    const $dialog: any = {}
    const ElNotification: any = {}

    const classes = useMemo(() => classnames([
        'vue-visual-editor',
        {
            'vue-visual-editor-preview': previewModel.value === true,
        }
    ]), [previewModel.value])

    const containerStyles = useMemo(() => ({
        width: `${dataModel.value.container.width}px`,
        height: `${dataModel.value.container.height}px`,
    }), [dataModel.value])

    const [focusData] = useState((() => {
        const getter = useCallback(() => {
            let focus: VisualEditorBlock[] = [];
            let notFocus: VisualEditorBlock[] = [];
            dataModel.value.blocks.forEach(item => (item.focus ? focus : notFocus).push(item))
            return {
                focus, notFocus,
                isMultipleSelected: focus.length > 1,
            }
        }, [])
        const ref = useRef(getter())
        useEffect(() => {
            ref.current = getter()
        }, [dataModel.value.blocks])
        return ref
    })())

    /*??????????????????*/
    const [componentDraggier] = useState(() => ({
        dragComponent: null as null | VisualEditorComponent,
        onComponentItemDragStart: (component: VisualEditorComponent) => {
            componentDraggier.dragComponent = component
            containerRef.current.addEventListener('dragenter', componentDraggier.onDragEnterContainer)
            containerRef.current.addEventListener('dragover', componentDraggier.onDragOverContainer)
            containerRef.current.addEventListener('dragleave', componentDraggier.onDragLeaveContainer)
            containerRef.current.addEventListener('drop', componentDraggier.onDropContainer)
            event.emit.dragstart()
        },
        onComponentItemDragEnd: () => {
            componentDraggier.dragComponent = null
            containerRef.current.removeEventListener('dragenter', componentDraggier.onDragEnterContainer)
            containerRef.current.removeEventListener('dragover', componentDraggier.onDragOverContainer)
            containerRef.current.removeEventListener('dragleave', componentDraggier.onDragLeaveContainer)
            containerRef.current.removeEventListener('drop', componentDraggier.onDropContainer)
        },
        onDragEnterContainer: (e: DragEvent) => {
            e.dataTransfer!.dropEffect = 'move'
        },
        onDragOverContainer: (e: DragEvent) => {
            e.preventDefault()
        },
        onDragLeaveContainer: (e: DragEvent) => {
            e.dataTransfer!.dropEffect = 'none'
        },
        onDropContainer: (e: DragEvent) => {
            const data = [...dataModel.value.blocks]
            data.push({
                componentKey: componentDraggier.dragComponent!.key!,
                focus: false,
                adjustPosition: true,
                top: e.offsetY,
                left: e.offsetX,
                width: 0,
                height: 0,
                zIndex: 100,
            })
            methods.updateBlocks(data)
            event.emit.dragend()
        },
    }))

    /*---------------------------------------block draggier-------------------------------------------*/
    /**
     * ?????????????????????????????????
     * ????????????????????????????????????render
     * ???????????????props?????????????????????????????????
     * @author  jeff
     * @date    2021/1/14 18:02
     */
    const markModel = useModel({x: null as null | number, y: null as null | number}, undefined, {autoWatch: false, autoEmit: false})

    const [focusHandler] = useState(() => ({
        onMousedownBlock: async (e: React.MouseEvent<HTMLDivElement>, data: VisualEditorBlock) => {
            if (previewModel.value) {
                return
            }
            // @ts-ignore
            if (e.button === 2) {
                /*????????????????????????*/
                return;
            }

            if (e.shiftKey) {
                if (focusData.current.focus.length <= 1) {
                    data.focus = true
                } else {
                    data.focus = !data.focus
                }
            } else {
                if (!data.focus) {
                    data.focus = true
                    methods.clearFocus(data)
                }
            }

            setSelectBlock(data)
            methods.updateBlocks([...dataModel.value.blocks])
            await delay()
            blockDraggier.onMousedownBlock(e, data)
        },
        onMousedownContainer: (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.currentTarget !== e.target) {
                return
            }
            setSelectBlock(null)
            if (!e.shiftKey) {
                methods.clearFocus()
            }
        },
    }))

    const [blockDraggier] = useState(() => ({
        blockDragData: {
            shiftKey: false,
            /*???????????????body???scrollTop,moveScrollTop ??????????????????body???scrollTop???*/
            startScrollTop: 0,
            moveScrollTop: 0,
            /*????????????????????????????????????top???left???*/
            startLeft: 0,
            startTop: 0,
            /*???????????????????????????????????????????????????*/
            startTime: 0,
            /*??????????????????????????????????????????????????????????????????*/
            focusList: [] as VisualEditorBlock[],
            /*????????????????????????????????????????????????*/
            startPositionList: [] as { left: number, top: number }[],
            /*??????????????????clientX???clientY*/
            startX: 0,
            startY: 0,
            /*????????????????????????clientX???clientY*/
            moveX: 0,
            moveY: 0,
            /*left??????block?????????????????????showLeft??????mark??????????????????*/
            availableMarks: {
                x: [] as { left: number, showLeft: number }[],
                y: [] as { top: number, showTop: number }[],
            },
            /*????????????????????????move??????????????????dragstart??????????????????mousedown*/
            dragging: false,
        },
        onMousedownBlock: (e: React.MouseEvent<HTMLDivElement>, data: VisualEditorBlock) => {
            if (previewModel.value) {
                return
            }
            const {focus, notFocus} = focusData.current
            blockDraggier.blockDragData = {
                shiftKey: e.shiftKey,
                startScrollTop: bodyRef.current.scrollTop,
                moveScrollTop: bodyRef.current.scrollTop,
                startLeft: data.left,
                startTop: data.top,
                startTime: Date.now(),
                focusList: focus,
                startPositionList: focus.map(meta => ({left: meta.left, top: meta.top})),
                startX: e.clientX,
                startY: e.clientY,
                moveX: e.clientX,
                moveY: e.clientY,
                dragging: false,
                availableMarks: (() => {
                    let x: { left: number, showLeft: number }[] = []
                    let y: { top: number, showTop: number }[] = []
                    const list: { top: number, left: number, width: number, height: number }[] = [
                        ...notFocus,
                        {
                            top: 0,
                            left: 0,
                            width: dataModel.value.container.width!,
                            height: dataModel.value.container.height!,
                        }
                    ]
                    list.forEach(meta => {
                        x.push({left: meta.left, showLeft: meta.left})                                                      // ?????????
                        x.push({left: meta.left + meta.width, showLeft: meta.left + meta.width})                            // ?????????
                        x.push({left: meta.left + meta.width / 2 - data.width / 2, showLeft: meta.left + meta.width / 2})   // ?????????
                        x.push({left: meta.left + meta.width - data.width, showLeft: meta.left + meta.width})               // ?????????
                        x.push({left: meta.left - data.width, showLeft: meta.left})                                         // ?????????

                        y.push({top: meta.top, showTop: meta.top})                                                          // ?????????
                        y.push({top: meta.top + meta.height, showTop: meta.top + meta.height})                              // ?????????
                        y.push({top: meta.top + meta.height / 2 - data.height / 2, showTop: meta.top + meta.height / 2})    // ?????????
                        y.push({top: meta.top + meta.height - data.height, showTop: meta.top + meta.height})                // ?????????
                        y.push({top: meta.top - data.height, showTop: meta.top})                                            // ?????????
                    })
                    return {
                        x, y
                    }
                })(),
            }
            document.body.addEventListener('mousemove', blockDraggier.onMousemoveDocument, true)
            document.body.addEventListener('mouseup', blockDraggier.onMouseupDocument, true)
            bodyRef.current.addEventListener('scroll', blockDraggier.onBodyScroll)
        },
        onMouseupDocument: () => {
            markModel.value = {x: null, y: null}
            blockDraggier.blockDragData.shiftKey = false
            document.body.removeEventListener('mousemove', blockDraggier.onMousemoveDocument, true)
            document.body.removeEventListener('mouseup', blockDraggier.onMouseupDocument, true)
            bodyRef.current.removeEventListener('scroll', blockDraggier.onBodyScroll);

            blockDraggier.blockDragData.dragging && event.emit.dragend();
        },
        onMousemoveDocument: (e: MouseEvent) => {
            blockDraggier.blockDragData.moveX = e.clientX
            blockDraggier.blockDragData.moveY = e.clientY
            blockDraggier.blockDragData.shiftKey = e.shiftKey
            blockDraggier.handleDragMove()
        },
        onBodyScroll: () => {
            blockDraggier.blockDragData.moveScrollTop = bodyRef.current.scrollTop
            blockDraggier.handleDragMove()
        },
        handleDragMove: () => {
            if (Date.now() - blockDraggier.blockDragData.startTime < 100) {
                return
            }
            if (!blockDraggier.blockDragData.dragging) {
                event.emit.dragstart()
                blockDraggier.blockDragData.dragging = true
            }
            const currentScrollTop = bodyRef.current.scrollTop
            let {shiftKey, focusList, startPositionList, startX, startY, startLeft, startTop, startScrollTop, moveX, moveY} = blockDraggier.blockDragData
            moveY += currentScrollTop - startScrollTop

            if (shiftKey) {
                const durX = Math.abs(moveX - startX)
                const durY = Math.abs(moveY - startY)
                durX > durY ? moveY = startY : moveX = startX
            }
            /*---------------------------------------??????start-------------------------------------------*/

            const currentLeft = startLeft + moveX - startX
            const currentTop = startTop + moveY - startY

            const {x, y} = blockDraggier.blockDragData.availableMarks

            let newMarkX: null | number = null
            const welt = props.welt || 5;
            for (let i = 0; i < x.length; i++) {
                const {left, showLeft} = x[i]
                if (Math.abs(left - currentLeft) < welt) {
                    newMarkX = showLeft
                    moveX = left + startX - startLeft
                    break
                }
            }
            if (newMarkX != null) {
                markModel.value.x = newMarkX
            } else {
                if (markModel.value.x != null) {
                    markModel.value.x = null
                }
            }

            let newMarkY: null | number = null
            for (let i = 0; i < y.length; i++) {
                const {top, showTop} = y[i];
                if (Math.abs(top - currentTop) < welt) {
                    newMarkY = showTop
                    moveY = top + startY - startTop
                    break
                }
            }
            if (newMarkY != null) {
                markModel.value.y = newMarkY
            } else {
                if (markModel.value.y != null) {
                    markModel.value.y = null
                }
            }
            /*---------------------------------------??????end-------------------------------------------*/

            const durX = moveX - startX
            const durY = moveY - startY
            focusList.map((meta, index) => {
                const startPosition = startPositionList[index]
                meta.left = startPosition.left + durX
                meta.top = startPosition.top + durY
            })
            methods.updateBlocks([...dataModel.value.blocks])
        },
    }))

    const [handler] = useState(() => ({
        onBlockContextmenu: (e: React.MouseEvent<HTMLDivElement>, block: VisualEditorBlock) => {
            e.preventDefault()
        },
    }))

    const [methods] = useState({
        updateBlocks: (blocks: VisualEditorBlock[]) => dataModel.value = {container: dataModel.value.container, blocks,},
        updateBlock: (newBlock: VisualEditorBlock, oldBlock: VisualEditorBlock) => {
            const blocks = [...dataModel.value.blocks]
            const index = blocks.indexOf(oldBlock)
            blocks.splice(index, 1, newBlock)
            // commander.updateModelValue({...dataModel.value, blocks}) // todo
            methods.updateBlocks(blocks)
            setSelectBlock(dataModel.value.blocks[index])
        },
        clearFocus: (exclude?: VisualEditorBlock) => {
            dataModel.value.blocks.forEach(d => (!exclude || exclude != d) && (d.focus = false))
        },
    })

    const commander = useVisualCommander({
        dataModel,
        focusData,
        methods,
        event,
    })

    /*???????????????*/
    const buttons = useRef([
        {label: '??????', icon: 'icon-back', handler: commander.undo, tip: 'ctrl+z'},
        {label: '??????', icon: 'icon-forward', handler: commander.redo, tip: 'ctrl+y, ctrl+shift+z'},
        {
            label: () => previewModel.value ? '??????' : '??????',
            icon: () => previewModel.value ? 'icon-edit' : 'icon-browse',
            handler: () => {
                if (!previewModel.value) {methods.clearFocus()}
                previewModel.value = !previewModel.value
            },
        },
        {
            label: '??????', icon: 'icon-import', handler: async () => {
                const text = await $dialog.textarea('', {title: '??????????????????JSON??????'})
                if (!text) {return}
                try {
                    const data = JSON.parse(text)
                    commander.updateModelValue(data)
                } catch (e) {
                    ElNotification({
                        title: '???????????????',
                        message: '?????????????????????????????????????????????'
                    })
                }
            }
        },
        {label: '??????', icon: 'icon-export', handler: () => $dialog.textarea(JSON.stringify(dataModel.value), {title: '?????????JSON??????', editReadonly: true})},
        {label: '??????', icon: 'icon-place-top', handler: () => commander.placeTop(), tip: 'ctrl+up'},
        {label: '??????', icon: 'icon-place-bottom', handler: () => commander.placeBottom(), tip: 'ctrl+down'},
        {label: '??????', icon: 'icon-delete', handler: () => commander.delete(), tip: 'ctrl+d, backspace, delete'},
        {label: '??????', icon: 'icon-reset', handler: () => commander.clear(),},
        {
            label: '??????', icon: 'icon-close', handler: () => {
                methods.clearFocus()
                setEditFlag(false)
            },
        },
    ])

    return (
        <div className={classes}>
            <div className="vue-visual-head">
                <ul>
                    {buttons.current.map((btn, index) => {
                        let {icon, label, tip} = btn
                        if (typeof label === "function") {label = label()}
                        if (typeof icon === "function") {icon = icon()}
                        const Content = (<li key={index} onClick={() => !!btn.handler && btn.handler()}>
                            <i className={`iconfont ${icon}`}/>
                            <span>{label}</span>
                        </li>)
                        return !!tip ? <Tooltip title={tip} key={index} placement="bottom">{Content}</Tooltip> : Content
                    })}
                </ul>
            </div>
            <div className="vue-visual-menu">
                <div className="vue-visual-menu-head">
                    <i className="iconfont icon-entypomenu"/>
                    <span>????????????</span>
                </div>
                <ul className="vue-visual-component-preview-list">
                    {props.option.componentList.map((comp) => {
                        const Preview = comp.preview() as any
                        return (
                            <li className="vue-visual-component-item"
                                key={comp.key}
                                draggable
                                onDragStart={() => componentDraggier.onComponentItemDragStart(comp)}
                                onDragEnd={componentDraggier.onComponentItemDragEnd}
                            >
                                {Preview}
                                <div className="vue-visual-component-item-name">{comp.name}</div>
                            </li>
                        )
                    })}
                </ul>
            </div>
            <div className="vue-visual-operator">
            </div>
            <div className="vue-visual-body" ref={bodyRef}>
                <div className="vue-visual-container"
                     style={containerStyles}
                     ref={containerRef}
                     onMouseDown={focusHandler.onMousedownContainer}>
                    {dataModel.value.blocks.map((d, index) => (<VisualEditorBlockRender
                        key={index}
                        data={d}
                        option={props.option}
                        formData={props.formData}
                        editSlots={props.children}
                        preview={previewModel.value}
                        customBlockProps={props.customBlockProps}
                        onMousedown={(e) => focusHandler.onMousedownBlock(e, d)}
                        onContextMenu={(e) => handler.onBlockContextmenu(e, d)}
                        onAdjustPosition={methods.updateBlock}
                    />))}
                    {markModel.value.x != null && <div className="vue-visual-x-mark" style={{left: `${markModel.value.x}px`}}/>}
                    {markModel.value.y != null && <div className="vue-visual-y-mark" style={{top: `${markModel.value.y}px`}}/>}
                </div>
            </div>
        </div>
    )
};